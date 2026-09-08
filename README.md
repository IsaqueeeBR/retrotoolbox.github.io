# Retro Shelf
retrotoolbox.github.io — Toolbox for RetroStudio

Site estático (sem backend) pra vasculhar as listas antigas de modelos free do
RetroStudio (Roblox) que rolaram no Discord Retro Dev e na planilha
"Free Models Masterlist". Não vende nada — é só uma "vitrine" pra achar o ID
do modelo que você quer e copiar com um clique.

## Estrutura

```
index.html      estrutura da página
style.css       visual (tema "catálogo retro")
script.js       carrega o JSON, filtra/busca, copia ID ao clicar
data/models.json  dados já traduzidos, é isso que o site lê
convert.py      script que gerou o models.json a partir dos CSVs originais
```

## Como publicar no GitHub Pages

1. Cria um repositório novo e sobe estes arquivos (mantendo a pasta `data/`).
2. Em Settings → Pages, escolhe a branch `main` e a pasta raiz (`/`).
3. Pronto, o site fica em `https://SEU_USUARIO.github.io/SEU_REPO/`.

Não precisa de nenhuma etapa de build — é só HTML/CSS/JS puro.

## Como atualizar a lista de modelos

Se você tiver uma versão nova dos CSVs (masterlist ou export do Discord):

1. Coloca os dois CSVs na mesma pasta do `convert.py` (ajusta os caminhos no
   topo do arquivo se os nomes forem diferentes).
2. Roda `python3 convert.py`.
3. Isso regenera `data/models.json`. Só subir esse arquivo de novo pro
   GitHub.

O script:
- Ignora linhas sem ID e avisa quantas ignorou no terminal.
- Detecta a categoria quando o arquivo de origem tem essa coluna (caso da
  masterlist). O export do Discord não tem categoria, então esses entram
  como "Sem categoria" no site.
- Marca como "destaque" (★) as descrições que tinham o símbolo ✰ na
  masterlist original.
- Tira a tag numérica do Discord (`nome#1234` → `nome`).

O `script.js` também tem uma checagem extra: se por algum motivo um item sem
ID acabar entrando no `models.json`, ele é escondido da lista e aparece um
aviso no console do navegador — então mesmo editando o JSON à mão isso fica
protegido.
