#!/usr/bin/env bash
# 커밋된 마이그레이션이 스키마 코드와 일치하는지 검사한다(CI, 로컬 공용). DB 접속은 필요 없다
set -euo pipefail

# 스냅샷 체인 충돌(두 브랜치가 같은 부모에서 마이그레이션을 만든 경우)이면 실패한다
drizzle-kit check

# drizzle-kit generate는 이름 변경처럼 물어봐야 하는 경우 TTY가 없으면 오류를 찍고도
# 종료 코드 0으로 끝나며 파일을 만들지 않는다(0.31.11). 그래서 종료 코드나 git 변경 여부가 아니라
# "변경 없음" 문구가 있을 때만 통과시킨다. 문구가 바뀌면 실패 쪽으로 깨진다
out=$(drizzle-kit generate 2>&1 </dev/null)
echo "$out"
if ! grep -q 'No schema changes, nothing to migrate' <<<"$out"; then
  echo '스키마 코드와 커밋된 마이그레이션이 다르다. pnpm db:generate로 만든 SQL을 리뷰해 커밋한다' >&2
  # 생성됐을 수 있는 파일을 보여 준다(CI에서는 job과 함께 버려진다)
  git status --porcelain -- db/migrations >&2
  exit 1
fi
