# Derleme bağlamı depo köküdür (alp-platform/deploy/docker-compose.comm-local.yml
# → `context: ../../alp-comm-toolkit`, `dockerfile: web/Dockerfile` — PCB ile
# birebir aynı desen). Dosyanın kendisi `web/` altında dursa da içindeki COPY
# yolları BAĞLAM KÖKÜNE görelidir (Docker'ın `dockerfile:` alanı yalnız dosyanın
# kendisini bulur, COPY'nin taban dizinini değiştirmez) — bu yüzden aşağıda
# `web/` öneki YOK, repo kökündeki dosyalar doğrudan adlarıyla kopyalanıyor.
#
# `docker build -f web/Dockerfile .` de bu yüzden repo KÖKÜNDEN çalıştırılmalı.

# ---- @mcanbektas/design paketini derle ----
# Comm bu paketi henüz GitHub Packages'tan değil `file:../alp-platform/design`
# ile alıyor (CLAUDE.md → "Bilinen borçlar"); iki depo kardeş dizin olmak
# ZORUNDA. Docker'ın kendi build context'i tek dizinle sınırlı olduğu için
# alp-platform/design AYRI bir build context olarak veriliyor — compose
# tarafı: docker-compose.comm-local.yml → `additional_contexts:
# alp-platform-design: ../../alp-platform/design`. Paket GitHub Packages'a
# yayınlanınca (Faz 4) bu aşama ve compose'daki additional_contexts satırı
# birlikte düşer, geriye `npm ci` yeterli kalır.
FROM node:22-alpine AS design-build
WORKDIR /design
COPY --from=alp-platform-design package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY --from=alp-platform-design . .
RUN npm run build

# ---- derleme ----
FROM node:22-alpine AS build
WORKDIR /src

# design paketi npm'in beklediği TAM göreli konuma (`file:../alp-platform/design`,
# WORKDIR /src'e göre karşılığı /alp-platform/design) `npm ci`'den ÖNCE konur —
# npm install anında dizin orada değilse bağımlılık çözülemez.
COPY --from=design-build /design /alp-platform/design

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
# Hesap motorları testten geçmeden imaja girmez (bkz. alp-pcb-toolkit
# Dockerfile'ındaki aynı gerekçe — PCB'de `npm test`, burada da).
RUN npm test -- --run
RUN npm run build

# ---- sunum ----
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
