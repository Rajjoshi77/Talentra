# Contributing to Talentra

Thank you for your interest in contributing to Talentra! Following these guidelines helps keep our codebase clean, secure, and maintainable.

---

## 🔒 Code Ownership & Proprietary Notice

This project is governed under a **Proprietary License**. By contributing to this repository:
1. You agree that all code modifications, additions, and enhancements you submit will become the intellectual property of **Rajjoshi77**.
2. You agree not to distribute, share, or publish cloned copies of this repository outside the official project organization.

---

## 🛠️ Development Workflow

### 1. Set Up Environment
Ensure you have Bun, Node 18+, and PostgreSQL running. Follow the installation steps outlined in the [README.md](README.md) file.

### 2. Standard Branching Format
Create a feature branch from `main`:
```bash
git checkout -b feat/your-feature-name
# or for bug fixes:
git checkout -b fix/bug-description
```

### 3. Local Verification
Before committing any changes, ensure all lint checks, type checks, and tests pass:
```bash
# Run tests
bun run test

# Check typescript compilation
bun run check-types
```

---

## 💡 Reporting Issues
* Use the **Bug Report** template to document reproduction steps.
* Do **NOT** post raw API keys or database passwords in issues or pull requests.
