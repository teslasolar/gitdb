#!/bin/bash
#
# GitDB Post-Write Hook: Update collection indexes
# This hook runs after Claude writes or edits files
#
# Exit codes:
#   0 = Success
#   1 = Non-blocking error (logged but continues)
#

CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
COLLECTIONS_DIR="$CLAUDE_PROJECT_DIR/data/collections"

# Function to update a collection's index
update_collection_index() {
    local collection_dir="$1"
    local collection_name=$(basename "$collection_dir")
    local index_file="$collection_dir/index.json"

    if [[ ! -d "$collection_dir" ]]; then
        return 0
    fi

    # Get all document IDs (files except index.json)
    local ids=()
    for doc_file in "$collection_dir"/*.json; do
        if [[ -f "$doc_file" && "$(basename "$doc_file")" != "index.json" ]]; then
            local id=$(basename "$doc_file" .json)
            ids+=("\"$id\"")
        fi
    done

    # Create index content
    local ids_json=$(IFS=,; echo "${ids[*]}")
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

    # Read existing createdAt or use current time
    local created_at="$timestamp"
    if [[ -f "$index_file" ]]; then
        local existing_created=$(grep -o '"createdAt"[[:space:]]*:[[:space:]]*"[^"]*"' "$index_file" 2>/dev/null | cut -d'"' -f4)
        if [[ -n "$existing_created" ]]; then
            created_at="$existing_created"
        fi
    fi

    # Write updated index
    cat > "$index_file" << EOF
{
  "ids": [$ids_json],
  "createdAt": "$created_at",
  "updatedAt": "$timestamp"
}
EOF

    echo "Updated index for collection: $collection_name (${#ids[@]} documents)"
}

# Update all collection indexes
if [[ -d "$COLLECTIONS_DIR" ]]; then
    for collection_dir in "$COLLECTIONS_DIR"/*/; do
        if [[ -d "$collection_dir" ]]; then
            update_collection_index "$collection_dir"
        fi
    done
fi

exit 0
