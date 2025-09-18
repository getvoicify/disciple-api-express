# ArgoCD Setup Instructions

## Prerequisites
- ArgoCD installed in your Kubernetes cluster
- GitHub token secret for ArgoCD to access private repos
- Sealed Secrets controller installed

## 1. Create GitHub Token Secret
```bash
# Create a GitHub personal access token with repo permissions
# Then create the secret in ArgoCD namespace
kubectl create secret generic github-token \
  --from-literal=token=<YOUR_GITHUB_TOKEN> \
  -n argocd
```

## 2. Apply the ApplicationSet
```bash
# Apply the ApplicationSet to your cluster
kubectl apply -f argocd/applicationset.yaml
```

## 3. Verify ApplicationSet
```bash
# Check if ApplicationSet is created
kubectl get applicationset -n argocd disciple-api

# Check for any generated applications
kubectl get applications -n argocd | grep disciple-api
```

## 4. Initial Setup for Environments

### For Staging and Production
The ApplicationSet will create applications for staging and production automatically, but they won't deploy until you update the image tags in `values.yaml`.

### For Preview Environments
1. Add the `preview` label to any PR
2. The GitHub workflow will build and push the Docker image
3. ArgoCD ApplicationSet will detect the PR and create a preview application automatically

## 5. Troubleshooting

### Check ApplicationSet logs
```bash
kubectl logs -n argocd deployment/argocd-applicationset-controller
```

### Check if GitHub webhook is configured (for PR detection)
The ApplicationSet polls GitHub every 300 seconds by default. For immediate updates, configure a GitHub webhook:
1. In your GitHub repo, go to Settings > Webhooks
2. Add webhook URL: `https://your-argocd-domain/api/webhook`
3. Select events: Pull requests

### Manual sync if needed
```bash
# For staging
argocd app sync disciple-api-staging

# For production
argocd app sync disciple-api-production

# For preview
argocd app sync disciple-api-preview-pr-<NUMBER>
```

## Environment URLs
- **Staging**: https://staging.disciple-api.example.com
- **Production**: https://disciple-api.example.com
- **Preview**: https://pr-{number}.preview.disciple-api.example.com

## Notes
- The ApplicationSet directly contains the image tags for each environment
- GitHub Actions will automatically update the ApplicationSet when releases are created
- Preview environments are automatically cleaned up when PRs are closed
- You'll need to update the domain names in the ApplicationSet to match your actual domains