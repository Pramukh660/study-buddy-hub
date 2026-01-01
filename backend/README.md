```markdown
# RAG on text data

<!-- Replace with a brief description of your project -->
A short description of what your project does and its main features.

## Introduction

This project uses **uv**, an extremely fast Python package installer and resolver written in Rust by [Astral](https://astral.sh). It provides unified management for virtual environments, dependencies, lockfiles, workspaces, and more — similar to Rye or Poetry, but significantly faster.

Official documentation: https://docs.astral.sh/uv/

## Important Requirement

This project requires an **OpenRouter API key** to function properly (used for accessing LLM models via OpenRouter).

1. Sign up or log in at https://openrouter.ai/
2. Go to the "Keys" section: https://openrouter.ai/keys
3. Create a new API key (or use an existing one)
4. Add the key to your environment:

   **Recommended: Create a `.env` file in the project root**

## Prerequisites and Setup

Follow these steps exactly to set up the project environment.

### 1. Install uv with the official standalone installer

#### Windows
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

#### Linux / macOS
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

> After installation, restart your terminal or source your shell profile if the `uv` command is not recognized.

### 2. Setup required Python version and initialize virtual environment

Create a virtual environment using Python 3.12.0:

```bash
uv venv --python 3.12.0
```

> uv will automatically download and install Python 3.12.0 if it is not already available on your system.

### 3. Activate the virtual environment

- **Windows**:
  ```powershell
  .venv\Scripts\activate
  ```

- **Linux / macOS**:
  ```bash
  source .venv/bin/activate
  ```

You should now see `(.venv)` in your terminal prompt, indicating the environment is active.

### 4. Initialize the project (only for new projects)

If starting a fresh project:

```bash
uv init <project-name>
```

Replace `<project-name>` with your desired project directory/name. This creates a basic `pyproject.toml`.

### 5. Add dependencies using requirements.txt

Install all dependencies listed in your `requirements.txt` file:

```bash
uv add -r requirements.txt
```

This command will:
- Read the packages from `requirements.txt`
- Add them to `pyproject.toml`
- Resolve dependencies quickly
- Generate or update the reproducible `uv.lock` lockfile
- Install everything into the active virtual environment

After this step, your environment is fully set up and ready for development.

## Next Steps

### Running the project

- With the virtual environment activated:
  ```bash
  python main.py
  ```

- Or without manual activation:
  ```bash
  uv run python main.py
  ```

### Common uv commands

- Sync environment with lockfile: `uv sync`
- Add a single package: `uv add <package-name>`
- Add a dev dependency: `uv add --dev <package>`
- Remove a package: `uv remove <package>`
- Upgrade all dependencies: `uv sync --upgrade`

## Development Tips

- Commit both `pyproject.toml` and `uv.lock` to version control for reproducible environments.
- Prefer `uv run` for scripts to avoid activation issues.

## Contributing

<!-- Add your guidelines here -->
Pull requests are welcome!