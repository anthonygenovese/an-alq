#!/bin/sh
# SPDX-License-Identifier: MIT
# Fail when a tracked source file has no SPDX-License-Identifier tag in its
# first few lines, or when the tag names a licence this tree does not allow.
# The project licence is MIT. Apache-2.0, BSD-2-Clause, BSD-3-Clause, and ISC
# are accepted only on vendored paths.

set -eu

cd "$(git rev-parse --show-toplevel)"

bad=0
checked=0
window=8

report() {
	bad=$((bad + 1))
	if [ -n "${GITHUB_ACTIONS:-}" ]; then
		printf '::error file=%s::%s\n' "$1" "$2"
	fi
	printf '%s: %s\n' "$1" "$2" >&2
}

in_scope() {
	case "$1" in
	*.ts | *.tsx | *.js | *.mjs | *.cjs | *.css | *.sh) return 0 ;;
	.github/workflows/*.yml | .github/workflows/*.yaml) return 0 ;;
	esac
	return 1
}

excluded() {
	case "$1" in
	*/node_modules/* | */.next/* | */dist/* | */vendor/* | */third_party/* | \
		*/fixtures/* | */fixtures.* | *fixture* | */__snapshots__/* | *.snap | \
		apps/web/next-env.d.ts | pnpm-lock.yaml)
		return 0 ;;
	esac
	return 1
}

vendored() {
	case "$1" in
	vendor/* | */vendor/* | third_party/* | */third_party/*) return 0 ;;
	esac
	return 1
}

licence_ok() {
	file=$1
	expr=$2
	case "$expr" in
	MIT) return 0 ;;
	esac
	if vendored "$file"; then
		case "$expr" in
		Apache-2.0 | BSD-2-Clause | BSD-3-Clause | ISC) return 0 ;;
		esac
	fi
	return 1
}

check_file() {
	file=$1
	line_no=0
	found=''
	expr=''
	while IFS= read -r line || [ -n "$line" ]; do
		line_no=$((line_no + 1))
		if [ "$line_no" -gt "$window" ]; then
			break
		fi
		case "$line" in
		*SPDX-License-Identifier:*)
			found=$line_no
			expr=${line#*SPDX-License-Identifier:}
			expr=$(printf '%s' "$expr" | sed 's/^[[:space:]]*//; s/[[:space:]]*\*\/[[:space:]]*$//; s/[[:space:]]*$//')
			break
			;;
		esac
	done <"$file"

	if [ -z "$found" ]; then
		report "$file" "no SPDX-License-Identifier tag in the first $window lines"
		return
	fi
	licence_ok "$file" "$expr" ||
		report "$file" "licence expression '$expr' is not allowed"
}

list=$(mktemp)
trap 'rm -f "$list"' EXIT
git ls-files | while IFS= read -r file; do
	in_scope "$file" || continue
	excluded "$file" && continue
	[ -L "$file" ] && continue
	[ -f "$file" ] || continue
	printf '%s\n' "$file"
done >"$list"

checked=$(wc -l <"$list" | tr -d ' ')
while IFS= read -r file; do
	[ -n "$file" ] || continue
	check_file "$file"
done <"$list"

if [ "$bad" -gt 0 ]; then
	printf '%d SPDX problems in %d files\n' "$bad" "$checked" >&2
	exit 1
fi
printf 'SPDX: %d files checked\n' "$checked"
