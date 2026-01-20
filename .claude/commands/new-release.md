## Input

The user wants to make a release. Their input might include information like:
* What kind of version bump they want. This can be a patch version, a minor version, or a major version bump.
* Any messages they want in the commit messages.
* Some tasks they might want you to run before releasing the new version.

Consider the user's input when performing the procedure. The input style is very open ended, so carefully consider the user's input.

## Procedure

If the user asks you to do any tasks unrelated to the "core version bump + release" action, do those first and commit them.

<example name="extra tasks">
    <input>
        /new-release Please run cargo fmt, cargo check, fix all broken unit tests, formatting issues, and clippy warnings. Then release a new version by bumping the patch version
    </input>
    <behavior>
        1. Do the tasks the user asked, cargo fmt, cargo check, fixing the broken tests and formatting isues.
        2. Make a commit using git commit -sm "Cargo fmt, cargo check, and fixed associated issues / tests"
        3. Do the release procedure (described later)
    </behavior>
</example>

If the work tree is dirty, such as uncomitted changes that we didn't make, analyze those changes and try to create a git commit to capture them.

### Core Release Procedure

The core release procedure is:
1. Bump the version in Cargo.toml. If the user specifies the "patch" version, bump the last number by 1. Example: 0.0.9 -> 0.0.10, 0.0.1 -> 0.0.2, etc. If the user specifies the "minor" version, bump the middle number by 1, and reset the last number to 0. Example: 0.0.1 -> 0.1.0, 0.2.9 -> 0.3.0. If the user specifies the "major" version, then bump the top number by 1, and reset the other two to 0. Example: 0.0.1 -> 1.0.0, 0.7.6 -> 1.0.0, 1.9.2 -> 2.0.0.
2. Create a git commit for the version bump (git commit -sm "Release version 1.0.0" for example)
3. Create a git tag for this version with the "v" prefix.
4. Push both to the origin remote.

## Rules

1. Never create commit's with attribution to Claude or anyone else. Just use the "normal" git commit style.
2. If the user doesn't specify any input at all, default to this behavior: run cargo update, cargo fmt, cargo check and fix any associated issues. Create a commit for that. Then bump the PATCH version, create a commit for that, create the git tag, and push it all up.