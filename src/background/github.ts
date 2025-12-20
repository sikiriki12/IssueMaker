import type { GitHubLabel, CreateIssueParams, CreatedIssue } from '@/types';
import { GITHUB_API_URL } from '@/core/constants';

const ASSETS_BRANCH = 'issuemaker-assets';

/**
 * Ensure the assets branch exists, creating it if necessary
 * Creates an orphan branch with a README to avoid polluting main branch history
 */
async function ensureAssetsBranch(
    owner: string,
    repo: string,
    token: string
): Promise<void> {
    // Check if branch already exists
    const branchCheck = await fetch(
        `${GITHUB_API_URL}/repos/${owner}/${repo}/branches/${ASSETS_BRANCH}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        }
    );

    if (branchCheck.ok) {
        return; // Branch already exists
    }

    // Get the default branch to find the base commit
    const repoResponse = await fetch(
        `${GITHUB_API_URL}/repos/${owner}/${repo}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        }
    );

    if (!repoResponse.ok) {
        throw new Error('Failed to get repository info');
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch;

    // Get the latest commit SHA from the default branch
    const refResponse = await fetch(
        `${GITHUB_API_URL}/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        }
    );

    if (!refResponse.ok) {
        throw new Error('Failed to get default branch reference');
    }

    const refData = await refResponse.json();
    const baseSha = refData.object.sha;

    // Create the new branch
    const createBranchResponse = await fetch(
        `${GITHUB_API_URL}/repos/${owner}/${repo}/git/refs`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ref: `refs/heads/${ASSETS_BRANCH}`,
                sha: baseSha,
            }),
        }
    );

    if (!createBranchResponse.ok) {
        const error = await createBranchResponse.json().catch(() => ({}));
        // Branch might have been created by another request
        if (error.message?.includes('Reference already exists')) {
            return;
        }
        throw new Error(error.message || 'Failed to create assets branch');
    }

    // Add a README to the branch to explain its purpose
    await fetch(
        `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/README.md`,
        {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: 'Initialize IssueMaker assets branch',
                content: btoa('# IssueMaker Assets\n\nThis branch contains screenshot attachments uploaded by the [IssueMaker](https://github.com/sikiriki12/IssueMaker) Chrome extension.\n\nThese images are referenced in GitHub issues. Please do not delete this branch.'),
                branch: ASSETS_BRANCH,
            }),
        }
    );
}

/**
 * Upload an image to a repository and return the raw URL
 * Images are stored in the issuemaker-assets branch to avoid polluting main
 */
export async function uploadImageToRepo(
    owner: string,
    repo: string,
    token: string,
    imageDataUrl: string,
    filename: string
): Promise<string> {
    // Extract base64 content from data URL
    const base64Match = imageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!base64Match) {
        throw new Error('Invalid image data URL format');
    }
    const base64Content = base64Match[1];

    // Ensure the assets branch exists
    await ensureAssetsBranch(owner, repo, token);

    // Create a unique path for the image
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `screenshots/${timestamp}-${safeName}`;

    // Check if file already exists on assets branch (to get SHA for update)
    let existingSha: string | undefined;
    try {
        const checkResponse = await fetch(
            `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}?ref=${ASSETS_BRANCH}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );
        if (checkResponse.ok) {
            const existing = await checkResponse.json();
            existingSha = existing.sha;
        }
    } catch {
        // File doesn't exist, that's fine
    }

    // Upload the file to the assets branch
    const uploadBody: Record<string, string> = {
        message: `Add screenshot: ${safeName}`,
        content: base64Content,
        branch: ASSETS_BRANCH,
    };

    if (existingSha) {
        uploadBody.sha = existingSha;
    }

    const response = await fetch(
        `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(uploadBody),
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.message || `Failed to upload image: ${response.status}`
        );
    }

    // We don't need the response content, just confirm the upload succeeded
    await response.json();

    // Use github.com/raw URL format which respects session authentication
    // This works for private repos when the viewer is logged in
    // Using the branch name for a stable URL (commit SHA would also work)
    return `https://github.com/${owner}/${repo}/raw/${ASSETS_BRANCH}/${path}`;
}

/**
 * Get labels for a repository
 */
export async function getRepoLabels(
    owner: string,
    repo: string,
    token: string
): Promise<GitHubLabel[]> {
    const response = await fetch(
        `${GITHUB_API_URL}/repos/${owner}/${repo}/labels?per_page=100`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.message || `GitHub API error: ${response.status} ${response.statusText}`
        );
    }

    return response.json();
}

/**
 * Create a new issue in a repository
 */
export async function createIssue(
    params: CreateIssueParams,
    token: string
): Promise<CreatedIssue> {
    const response = await fetch(
        `${GITHUB_API_URL}/repos/${params.owner}/${params.repo}/issues`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: params.title,
                body: params.body,
                labels: params.labels || [],
                assignees: params.assignees || [],
            }),
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.message || `GitHub API error: ${response.status} ${response.statusText}`
        );
    }

    return response.json();
}

/**
 * Validate a GitHub token by fetching user info
 */
export async function validateToken(token: string): Promise<boolean> {
    try {
        const response = await fetch(`${GITHUB_API_URL}/user`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Check if user has access to a repository
 */
export async function checkRepoAccess(
    owner: string,
    repo: string,
    token: string
): Promise<boolean> {
    try {
        const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Fetch all repositories the user has access to (owned + collaborator)
 * Returns array of "owner/repo" strings, sorted by most recently pushed
 */
export async function fetchUserRepos(token: string): Promise<string[]> {
    const repos: string[] = [];
    let page = 1;
    const perPage = 100;

    // Fetch repos with push access (can create issues)
    while (page <= 5) { // Limit to 500 repos max
        const response = await fetch(
            `${GITHUB_API_URL}/user/repos?per_page=${perPage}&page=${page}&sort=pushed&direction=desc&affiliation=owner,collaborator,organization_member`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );

        if (!response.ok) {
            if (page === 1) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    errorData.message || `GitHub API error: ${response.status}`
                );
            }
            break;
        }

        const data = await response.json();
        if (data.length === 0) break;

        for (const repo of data) {
            // Only include repos where user can create issues
            if (repo.permissions?.push || repo.permissions?.admin) {
                repos.push(repo.full_name);
            }
        }

        if (data.length < perPage) break;
        page++;
    }

    return repos;
}
