How to push this scaffold to a new GitHub repository

1. Create a new repository on GitHub (or any git host). Note its URL (e.g., https://github.com/your-org/turbotax-poc)
2. From this folder run the following commands:

```bash
# initialize a new git repo
rm -rf .git
git init
git add .
git commit -m "Initial Turbotax POC scaffold"
# add remote and push
git remote add origin git@github.com:your-org/turbotax-poc.git
git branch -M main
git push -u origin main
```

3. Configure GitHub repository secrets (Repository Settings -> Secrets):
- TURBOTAX_MASTER_KEY<br/>
- INTUIT_CLIENT_ID (optional)<br/>
- INTUIT_CLIENT_SECRET (optional)<br/>
- (optional) DOCKER_USERNAME & DOCKER_PASSWORD if pushing to Docker Hub

4. After pushing, CI will build & publish the container to GHCR if you have GITHUB_TOKEN permissions. To publish to Docker Hub, add the Docker Hub secrets.

Notes
-----
- For demo deployments, choose a platform (Render/Heroku/ECS) and configure your workflow.
- If you'd like, I can create the remote repo and push this scaffold for you (requires GitHub permissions/remote creation step).