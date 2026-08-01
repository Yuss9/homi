# Releases and container images

Homi uses Conventional Commits, Release Please, GitHub Releases, and GitHub
Container Registry (GHCR) to make releases repeatable.

## Release flow

1. Create a focused branch from `main`; never push product changes directly to
   `main`.
2. Open a pull request whose title follows Conventional Commits.
3. Review and squash-merge the pull request into `main`.
4. Release Please updates or creates a release pull request containing the next
   version and changelog entries.
5. Merge the release pull request. Release Please creates the version tag and
   GitHub Release.
6. The container workflow publishes a multi-platform image to
   `ghcr.io/OWNER/homi` with version, major/minor, `latest`, and commit SHA tags.

Use `feat` for a minor release, `fix` for a patch release, and a `!` or a
`BREAKING CHANGE:` footer for a major release. Documentation, test, build, CI,
and chore commits appear in history but do not normally advance the version.

## One-time repository settings

An administrator must configure these settings after the workflows are merged:

1. In **Settings → General → Pull Requests**, enable squash merging and set the
   default squash commit message to the pull request title.
2. Protect `main`: require pull requests, approvals as appropriate, and the CI
   and Conventional Commit checks. Disable force pushes and direct pushes.
3. In **Settings → Actions → General → Workflow permissions**, allow GitHub
   Actions to create and approve pull requests so Release Please can maintain
   its release pull request.
4. After the first image is published, open its package settings, make the
   package public, and connect it to the repository if GitHub did not connect it
   automatically. The package then appears in the repository's **Packages**
   section.

The workflows use the repository `GITHUB_TOKEN`; no personal access token or
registry password is required.

## Pull and run a published image

Replace `OWNER` and `VERSION` with the repository owner and a published tag:

```bash
docker pull ghcr.io/OWNER/homi:VERSION
HOMI_IMAGE=ghcr.io/OWNER/homi:VERSION docker compose up -d
```

Pin a full version such as `1.2.3` in production. The floating `latest`, major,
and major/minor tags are convenient but can change after a new release.

## First release and troubleshooting

The release manifest starts at the version currently declared in
`package.json`. If the project should restart at a different pre-1.0 version,
change both files together before merging the first release pull request.

If no release pull request appears, check that Actions can create pull requests
and that merged titles follow Conventional Commits. If the package is private,
authenticate to GHCR with a token that has `read:packages`; public packages can
be pulled anonymously.
