// ================================
// Issue Types
// ================================

export type IssueType = 'bug' | 'feature' | 'other';

// ================================
// Attachment & Annotation
// ================================

export type AnnotationTool = 'arrow' | 'rectangle' | 'text' | 'blur' | 'select';

export interface AnnotationData {
    id: string;
    type: 'arrow' | 'rectangle' | 'text' | 'blur';
    startX: number;
    startY: number;
    endX?: number;
    endY?: number;
    color: string;
    text?: string;
}

export interface Attachment {
    id: string;
    type: 'screenshot' | 'image' | 'file';
    dataUrl: string;
    filename: string;
    description?: string;
    annotations?: AnnotationData[];
}

// ================================
// Context Capture
// ================================

export interface ConsoleEntry {
    level: 'log' | 'warn' | 'error' | 'info' | 'debug';
    message: string;
    timestamp: number;
    stack?: string;
}

export interface NetworkError {
    url: string;
    method: string;
    status?: number;
    statusText?: string;
    errorMessage?: string;
    timestamp: number;
}

export interface EnvironmentInfo {
    url: string;
    pageTitle: string;
    userAgent: string;
    viewportWidth: number;
    viewportHeight: number;
    timestamp: number;
}

export interface IssueContext {
    environment: EnvironmentInfo;
    consoleLogs: ConsoleEntry[];
    networkErrors: NetworkError[];
}

// ================================
// Issue Draft
// ================================

export interface AIDraft {
    title: string;
    body: string;
    generatedAt: number;
}

export interface IssueDraft {
    id: string;
    createdAt: number;
    type: IssueType;
    userTitle: string;
    userDescription: string;
    stepsToReproduce: string[];
    expectedBehavior: string;
    actualBehavior: string;
    labels: string[];
    attachments: Attachment[];
    context: IssueContext;
    includeConsoleLogs: boolean;
    includeNetworkErrors: boolean;
    includeEnvironment: boolean;
    aiDraft?: AIDraft;
}

// ================================
// Extension Settings
// ================================

export interface ExtensionSettings {
    geminiApiKey: string;
    githubToken: string;
}

// ================================
// GitHub API Types
// ================================

export interface GitHubLabel {
    id: number;
    name: string;
    color: string;
    description?: string;
}

export interface CreateIssueParams {
    owner: string;
    repo: string;
    title: string;
    body: string;
    labels?: string[];
    assignees?: string[];
}

export interface CreatedIssue {
    id: number;
    number: number;
    title: string;
    html_url: string;
}

// ================================
// Messaging
// ================================

export type MessageType =
    | 'GET_SETTINGS'
    | 'SAVE_SETTINGS'
    | 'CAPTURE_SCREENSHOT'
    | 'CAPTURE_SCREENSHOT_NOW'
    | 'GET_PAGE_CONTEXT'
    | 'GENERATE_ISSUE'
    | 'CREATE_GITHUB_ISSUE'
    | 'CREATE_GITHUB_ISSUE_WITH_IMAGES'
    | 'GET_REPO_LABELS'
    | 'GET_USER_REPOS'
    | 'SAVE_DRAFT'
    | 'GET_DRAFT'
    | 'CLEAR_DRAFT';

export interface ExtensionMessage<T = unknown> {
    type: MessageType;
    payload?: T;
}

export interface MessageResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}
