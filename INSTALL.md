# Installation Guide

## Quick Install (Recommended)

If the one-click script doesn't work, use this method:

```bash
# Clone the repository
git clone https://github.com/nimroozy/ifilm.git
cd ifilm

# Make install script executable
chmod +x install.sh

# Run installation
sudo ./install.sh
```

## Alternative: Direct Download

If git clone doesn't work:

```bash
# Download the install script directly
wget https://raw.githubusercontent.com/nimroozy/ifilm/main/install.sh
chmod +x install.sh
sudo ./install.sh
```

## Manual Installation

See [README.md](README.md) for detailed manual installation instructions.

## Troubleshooting

### If you get 404 error:
1. Make sure the repository is public: https://github.com/nimroozy/ifilm
2. Try cloning the repository first: `git clone https://github.com/nimroozy/ifilm.git`
3. Then run: `cd ifilm && chmod +x install.sh && sudo ./install.sh`

### If curl fails:
- Use `wget` instead: `wget https://raw.githubusercontent.com/nimroozy/ifilm/main/install.sh`
- Or clone the repo and run the script locally

