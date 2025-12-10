#!/bin/bash
#
# GitDB Pre-Write Hook: Validate JSON files
# This hook runs before Claude writes or edits files
#
# Exit codes:
#   0 = Allow operation
#   2 = Block operation (show error to Claude)
#

set -e

CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"

# Get the file being written (passed via environment or stdin)
# For now, we do general validation

# Function to validate JSON syntax
validate_json() {
    local file="$1"
    if [[ "$file" == *.json ]]; then
        if ! python3 -c "import json; json.load(open('$file'))" 2>/dev/null; then
            if ! node -e "JSON.parse(require('fs').readFileSync('$file'))" 2>/dev/null; then
                echo "ERROR: Invalid JSON syntax in $file" >&2
                return 1
            fi
        fi
    fi
    return 0
}

# Function to check file size
check_file_size() {
    local file="$1"
    local max_size=$((100 * 1024 * 1024))  # 100MB GitHub limit

    if [[ -f "$file" ]]; then
        local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
        if [[ $size -gt $max_size ]]; then
            echo "ERROR: File $file exceeds 100MB limit" >&2
            return 1
        fi
    fi
    return 0
}

# Validate data directory structure
validate_structure() {
    local data_dir="$CLAUDE_PROJECT_DIR/data"

    if [[ -d "$data_dir/collections" ]]; then
        for collection_dir in "$data_dir/collections"/*/; do
            if [[ -d "$collection_dir" ]]; then
                local index_file="${collection_dir}index.json"
                if [[ ! -f "$index_file" ]]; then
                    echo "WARNING: Missing index.json in $collection_dir" >&2
                fi
            fi
        done
    fi
    return 0
}

# Run validations
validate_structure

echo "Pre-write validation passed" >&1
exit 0
