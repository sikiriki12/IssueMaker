import type { GitHubLabel, CreateIssueParams, CreatedIssue } from '@/types';
import { GITHUB_API_URL } from '@/core/constants';

/**
 * Upload an image to a repository and return the raw URL
 * Images are stored in a .issuemaker folder in the repo
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

    // Create a unique path for the image
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `.issuemaker/screenshots/${timestamp}-${safeName}`;

    // Check if file already exists (to get SHA for update)
    let existingSha: string | undefined;
    try {
        const checkResponse = await fetch(
            `${GITHUB_API_URL}/repos/${owner}/${repo}/contents/${path}`,
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

    // Upload the file
    const uploadBody: Record<string, string> = {
        message: `Add screenshot from IssueMaker`,
        content: base64Content,
        branch: 'main', // Default to main branch
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

        // Try alternative branches if main doesn't work
        if (response.status === 404 || response.status === 422) {
            // Try 'master' branch
            uploadBody.branch = 'master';
            const retryResponse = await fetch(
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

            if (!retryResponse.ok) {
                throw new Error(
                    errorData.message || `Failed to upload image: ${response.status}`
                );
            }

            const retryResult = await retryResponse.json();
            return retryResult.content.download_url;
        }

        throw new Error(
            errorData.message || `Failed to upload image: ${response.status}`
        );
    }

    const result = await response.json();
    // Return the raw URL that can be embedded in markdown
    return result.content.download_url;
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
