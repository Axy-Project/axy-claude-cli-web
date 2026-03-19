import { Octokit } from 'octokit'

export class GitHubService {
  private getClient(token: string): Octokit {
    return new Octokit({ auth: token })
  }

  async listRepos(token: string, page = 1, perPage = 30) {
    const octokit = this.getClient(token)
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: perPage,
      page,
    })
    return data
  }

  async searchRepos(token: string, query: string, page = 1, perPage = 30) {
    const octokit = this.getClient(token)
    const { data } = await octokit.rest.search.repos({
      q: query,
      per_page: perPage,
      page,
    })
    return data
  }

  async getRepo(token: string, owner: string, repo: string) {
    const octokit = this.getClient(token)
    const { data } = await octokit.rest.repos.get({ owner, repo })
    return data
  }

  async createRepo(token: string, name: string, options: { description?: string; private?: boolean } = {}) {
    const octokit = this.getClient(token)
    const { data } = await octokit.rest.repos.createForAuthenticatedUser({
      name,
      description: options.description,
      private: options.private ?? true,
      auto_init: true,
    })
    return data
  }

  async listBranches(token: string, owner: string, repo: string) {
    const octokit = this.getClient(token)
    const { data } = await octokit.rest.repos.listBranches({ owner, repo })
    return data
  }

  async listPrs(token: string, owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
    const octokit = this.getClient(token)
    const { data } = await octokit.rest.pulls.list({ owner, repo, state })
    return data
  }

  async createPr(token: string, owner: string, repo: string, params: {
    title: string
    body?: string
    head: string
    base: string
  }) {
    const octokit = this.getClient(token)
    const { data } = await octokit.rest.pulls.create({ owner, repo, ...params })
    return data
  }

  async getPr(token: string, owner: string, repo: string, pullNumber: number) {
    const octokit = this.getClient(token)
    const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber })
    return data
  }

  async mergePr(token: string, owner: string, repo: string, pullNumber: number, params?: {
    merge_method?: 'merge' | 'squash' | 'rebase'
    commit_title?: string
  }) {
    const octokit = this.getClient(token)
    const { data } = await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      merge_method: params?.merge_method || 'squash',
      commit_title: params?.commit_title,
    })
    return data
  }

  async listIssues(token: string, owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
    const octokit = this.getClient(token)
    const { data } = await octokit.rest.issues.listForRepo({ owner, repo, state })
    return data
  }

  async createIssue(token: string, owner: string, repo: string, params: {
    title: string
    body?: string
    labels?: string[]
  }) {
    const octokit = this.getClient(token)
    const { data } = await octokit.rest.issues.create({ owner, repo, ...params })
    return data
  }

  async listWorkflowRuns(token: string, owner: string, repo: string, perPage = 20) {
    const octokit = this.getClient(token)
    const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      per_page: perPage,
    })
    return data.workflow_runs
  }

  async listOrgs(token: string) {
    const octokit = this.getClient(token)
    const { data } = await octokit.rest.orgs.listForAuthenticatedUser()
    return data
  }
}

export const githubService = new GitHubService()
