#!/bin/bash
#
# GitDB Post-Command Hook: Run after bash commands
# This hook runs after Claude executes bash commands
#
# Exit codes:
#   0 = Success
#   1 = Non-blocking error
#

CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"

# Log command execution (optional)
log_command() {
    local log_file="$CLAUDE_PROJECT_DIR/.claude/command.log"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

    # Only log if log file exists or logging is enabled
    if [[ -f "$log_file" ]] || [[ "${GITDB_LOG_COMMANDS:-false}" == "true" ]]; then
        echo "[$timestamp] Command executed" >> "$log_file" 2>/dev/null || true
    fi
}

# Check for git operations and suggest sync
check_git_status() {
    if [[ -d "$CLAUDE_PROJECT_DIR/.git" ]]; then
        local status=$(git -C "$CLAUDE_PROJECT_DIR" status --porcelain 2>/dev/null)
        if [[ -n "$status" ]]; then
            local changed_count=$(echo "$status" | wc -l | tr -d ' ')
            if [[ $changed_count -gt 5 ]]; then
                echo "Note: $changed_count files changed. Consider running /gitdb/sync"
            fi
        fi
    fi
}

# Auto-format JSON files if jq is available
auto_format_json() {
    if command -v jq &> /dev/null; then
        for json_file in "$CLAUDE_PROJECT_DIR"/data/**/*.json; do
            if [[ -f "$json_file" ]]; then
                # Only format if file is valid JSON
                if jq '.' "$json_file" > /dev/null 2>&1; then
                    local formatted=$(jq '.' "$json_file")
                    echo "$formatted" > "$json_file"
                fi
            fi
        done 2>/dev/null || true
    fi
}

# Run post-command tasks
log_command
check_git_status

exit 0
