const { Octokit } = require('@octokit/rest');

async function publish(pluginConfig, context) {
  const {
    options: { repositoryUrl },
    branch,
    nextRelease: { name, gitTag, notes },
    logger,
    env,
  } = context;

  const { owner, repo } = parseRepoUrl(repositoryUrl);

  const release = {
    owner,
    repo,
    tag_name: gitTag,
    target_commitish: branch.name,
    name,
    body: notes,
    prerelease: true, // Always create as prerelease
  };

  const baseUrl = env.GH_PREFIX || env.GITHUB_PREFIX || '';

  const github = new Octokit({
    auth: `token ${env.GITHUB_TOKEN}`,
    baseUrl,
  });

  const {
    data: { html_url: url, id: releaseId },
  } = await github.repos.createRelease(release);

  logger.log('Published GitHub release: %s', url);

  return { url, name: 'GitHub release', id: releaseId };
}

async function success(pluginConfig, context) {
  const {
    options: { repositoryUrl },
    commits,
    nextRelease,
    releases,
    logger,
    env,
  } = context;

  const { owner, repo } = parseRepoUrl(repositoryUrl);

  const baseUrl = env.GH_PREFIX || env.GITHUB_PREFIX || '';

  const github = new Octokit({
    auth: `token ${env.GITHUB_TOKEN}`,
    baseUrl,
  });

  const releaseUrl = releases.find(release => release.name === 'GitHub release')?.url;

  const successComment = `🎉 This PR is included in version ${nextRelease.version} 🎉

The release is available on:
- GitHub Container Registry: \`ghcr.io/${owner}/${repo}:${nextRelease.version}\`
- [GitHub release](${releaseUrl}) (prerelease)
- [Staging Environment](https://staging.infra.api.pottersville.church)

**Note**: This release is marked as prerelease and deployed to staging. To promote to production, manually edit the GitHub release to remove the prerelease flag.

Your **[semantic-release](https://github.com/semantic-release/semantic-release)** bot 📦🚀`;

  // Find PRs related to the commits in this release
  const prs = new Set();

  for (const commit of commits) {
    const prMatch = commit.message.match(/\(#(\d+)\)/);
    if (prMatch) {
      prs.add(parseInt(prMatch[1], 10));
    }
  }

  // Comment on each PR
  for (const prNumber of prs) {
    try {
      await github.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: successComment,
      });
      logger.log('Added success comment to PR #%d', prNumber);
    } catch (error) {
      logger.error('Failed to comment on PR #%d: %s', prNumber, error.message);
    }
  }
}

function parseRepoUrl(repositoryUrl) {
  const [match, auth, host, path] = /^(?!.+:\/\/)(?:(?<auth>.*)@)?(?<host>.*?):(?<path>.*)$/.exec(repositoryUrl) || [];
  try {
    const [, owner, repo] = /^\/(?<owner>[^/]+)?\/?(?<repo>.+?)(?:\.git)?$/.exec(
      new URL(match ? `ssh://${auth ? `${auth}@` : ''}${host}/${path}` : repositoryUrl).pathname
    );
    return { owner, repo };
  } catch {
    return {};
  }
}

module.exports = {
  publish,
  success,
};