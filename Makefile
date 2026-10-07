init:
	python3 scripts/init-env.py
install:
	npm ci
	npm ci --prefix frontend
	dotnet restore Projects.slnx --locked-mode
db:
	docker compose up -d --wait postgres
migrate:
	docker compose --profile tools run --rm --build migrate
seed:
	docker compose --profile tools run --rm seed
dev:
	npm run dev
up:
	docker compose --profile app up -d --build app
refresh:
	docker compose --profile app up -d --build app
check:
	npm run build
	npm test
