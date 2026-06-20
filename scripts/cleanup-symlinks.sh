
#!/bin/bash
# Script to clean up broken symlinks in /tmp directory
echo "Cleaning up broken symlinks in /tmp..."
find /tmp -type l -exec test ! -e {} \; -delete
echo "Cleanup complete!"
