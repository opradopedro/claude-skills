# Manual dos canais novos (Signal Lost e Old Tales Retold)

Manual de uso, em portugues e sem termo tecnico. Dois canais novos em ingles, no YouTube, postando
sozinhos todos os dias.

| | Canal 1 | Canal 2 |
|---|---|---|
| Nome sugerido | **Signal Lost** | **Old Tales Retold** |
| Assunto | terror realista de sobrevivencia, em series de 3 a 4 partes | historias classicas (Shakespeare, Poe, Odisseia) narradas |
| Hora de publicar | **19h** de Nova York | **meio-dia** de Nova York |
| Quantos por dia | 1 | 1 |
| Pasta | `skills/canal-survival` | `skills/canal-classics` |
| Codigo dos videos | SV001, SV002... | CL001, CL002... |

**Sao 2 videos por dia no total**, um de cada canal, em horarios diferentes (almoco e noite de Nova
York). Uma serie de 4 partes sai ao longo de 4 dias. Dobrar para 2 por canal depois e uma linha de
configuracao — tem como fazer na secao sobre credito, mais abaixo.

Os dois reaproveitam o motor **ja testado** do seu canal Hora Muerta. **Nenhum arquivo dos seus
canais atuais foi alterado** — eles continuam funcionando exatamente como antes.

---

## O Crew nao tem esta conversa (e normal)

O chat do navegador e o Crew no seu PC sao **dois lugares diferentes**. O Crew acabou de ser instalado:
ele nao conhece nada do que a gente combinou, e nao da para "mudar" esta conversa para la.

O que passa de um para o outro sao os **arquivos**, pelo GitHub. Toda a combinacao esta escrita neste
manual e nos arquivos da branch `canais-teste-en` — e o Crew le tudo isso.

Para colocar o Crew a par, cole isto no chat dele:

> Leia o arquivo MANUAL-PEDRO.md e os SKILL.md das pastas skills/canal-survival e
> skills/canal-classics na branch canais-teste-en do repositorio C:\claude-skills.
> Eles explicam dois canais de YouTube em ingles que postam sozinhos. Me diga em que etapa
> do manual eu estou e qual e o proximo passo.

---

## ANTES DE TUDO: o arquivo .zip nao serve

Voce me disse que o repositorio esta em `C:\claude-skills\claude-skills-main.zip`.

Um `.zip` e uma **caixa fechada e compactada**. Programas nao conseguem rodar nada de dentro dela.
E tem um problema pior: um `.zip` baixado do GitHub **nao tem ligacao nenhuma com o GitHub** — as
mudancas que eu fizer nunca chegam nele, e as suas nunca voltam.

Voce precisa de uma **pasta de verdade, ligada ao GitHub**. Depois de instalar o Crew, cole isto no
chat dele:

> Apague o arquivo C:\claude-skills\claude-skills-main.zip e, no lugar, baixe o repositorio
> opradopedro/claude-skills do GitHub direto para a pasta C:\claude-skills, ligado ao GitHub
> (git clone). Depois entre na branch canais-teste-en e me mostre o que tem dentro.

Pronto. Daqui para frente a pasta certa e **`C:\claude-skills`**.

---

## Etapa 1 — Instalar o que o programa precisa

Quatro coisas: o FFmpeg (junta som e imagem), o Chromium (desenha as cenas), os pacotes de audio e a
tabela de fusos horarios.

Cole isto no chat do Crew:

> No Windows, instale o que os canais precisam: o FFmpeg (e confirme que o comando ffmpeg funciona no
> terminal), o Python 3.12, e os pacotes numpy, soundfile, playwright, faster-whisper, sherpa-onnx e
> tzdata. Depois rode "playwright install chromium". Me avise se algum passo falhar.

Se preferir fazer na mao, no PowerShell:

```powershell
winget install Gyan.FFmpeg
pip install numpy soundfile playwright faster-whisper sherpa-onnx tzdata
playwright install chromium
```

---

## Etapa 2 — Criar os dois canais no YouTube

Isso **so voce pode fazer**. Eu nao tenho como entrar na sua conta.

1. Crie a conta Google nova (voce ja planejou isso).
2. Nela, crie **dois canais** no YouTube.
3. **Verifique os dois por telefone** (youtube.com/verify). Sem isso, o programa nao consegue trocar a
   capa do video.
4. Anote o **nome exato** de cada canal, com maiuscula e minuscula iguaizinhas.
5. Abra os dois arquivos abaixo e escreva o nome exato no campo `canal_titulo`:
   - `skills/canal-survival/canal.json`
   - `skills/canal-classics/canal.json`

**Por que isso importa:** os dois canais ficam na mesma conta Google. Se a autorizacao de um for usada
por engano no outro, o video iria para o canal errado. Com o nome preenchido, o programa **se recusa a
enviar** e avisa `CANAL ERRADO`. E a sua rede de seguranca.

---

## Etapa 3 — Pegar as chaves de acesso

Sao 4 chaves. Pense nelas como **a chave da sua casa**: ficam num arquivo so no seu computador, nunca
no GitHub, nunca no chat.

1. Na pasta `C:\claude-skills`, faca uma copia do arquivo `.env.example` e renomeie a copia para
   **`.env`** (so isso, sem o ".example").
2. Abra o `.env` no Bloco de Notas e preencha:

| Chave | Onde conseguir |
|---|---|
| `GEMINI_API_KEY` | **Reaproveite a que voce ja usa** nos canais atuais |
| `YT_CLIENT_ID` e `YT_CLIENT_SECRET` | **Reaproveite as que voce ja usa** (sao do projeto, nao do canal) |
| `YT_REFRESH_TOKEN_SURVIVAL` | developers.google.com/oauthplayground, entrando com o **canal 1** |
| `YT_REFRESH_TOKEN_CLASSICS` | o mesmo, entrando com o **canal 2** |

### Por que reaproveitar (e nao criar projeto novo)

Uma chave de API **nao tem vinculo nenhum com canal de YouTube**. Ela so autentica voce no servico do
Google: o programa manda texto, recebe audio de volta. O Google nao sabe nem se importa em que canal
aquele audio vai ser usado.

O mesmo vale para o par `YT_CLIENT_ID` / `YT_CLIENT_SECRET`: eles identificam o **aplicativo**, nao o
canal. O que separa um canal do outro e so o `YT_REFRESH_TOKEN_*` — e esse sim voce gera entrando com
cada canal.

Vantagem pratica: **voce nao precisa criar projeto novo no Google Cloud.** Projeto novo costuma pedir
cadastro de pagamento, porque o Google vem restringindo o plano gratis para projetos recem-criados.
Reaproveitando o projeto que ja funciona, esse problema desaparece.

> Se o app OAuth estiver em modo "Teste", adicione o e-mail da conta nova como **usuario de teste** na
> tela de permissao OAuth, senao o login dos canais novos e recusado.

### O unico cuidado: a cota de voz e compartilhada

A voz do Gemini no plano gratis da cerca de **10 narracoes por dia, por chave** — e essa conta passa a
ser somada entre **todos** os canais que usam a mesma chave. Esta e a conta de hoje:

| Canal | Narracoes por dia |
|---|---|
| Hora Muerta | 1 a 2 |
| So You Built It | 2 |
| Signal Lost | 1 |
| Old Tales Retold | 1 |
| **Total** | **5 a 6 de ~10** ✅ |

Cabe com folga. **Mas isso so e verdade porque os canais novos produzem UMA parte por noite**, em vez
da serie inteira de uma vez. Se produzissem 4 partes de uma vez, seriam 8 narracoes num dia so, e os
seus canais que ja funcionam poderiam ficar sem cota e falhar.

E isso que o campo `"partes_por_vez": 1` do `canal.json` garante. **Nao mude para 0 enquanto estiver
usando a mesma chave dos canais antigos.**

Se um dia a cota estourar, ninguem perde nada: o programa para sem publicar, avisa `VOZ FALHOU`, e no
dia seguinte funciona.

Se travar nessa etapa, me chame: eu te guio clique por clique. E a parte mais chata de todo o processo,
e e so uma vez.

> ⚠️ **Aviso importante:** enquanto o seu aplicativo do Google estiver em modo "Teste", as duas ultimas
> chaves **vencem em 7 dias**. Para elas durarem, publique o aplicativo na tela "Tela de permissao
> OAuth" do Google Cloud. Se aparecer `vencido ou revogado`, e isso.

Para conferir se a chave e do canal certo:

```powershell
cd C:\claude-skills
python motor-en\yt_upload.py canal --canal skills\canal-survival
```

Ele imprime o nome do canal. Se vier o nome errado, as chaves estao trocadas.

---

## Etapa 4 — Primeiro teste (nada vai para o ar)

Aqui a gente faz o vídeo e **ninguem ve**, para voce conferir com os proprios olhos.

**Primeiro, so as imagens** (rapido, uns 2 minutos):

```powershell
cd C:\claude-skills
python motor-en\produce.py skills\canal-survival --teste --saida C:\temp\sv
```

Isso gera varias fotos `.jpg` na pasta `C:\temp\sv`. **Abra e olhe cada uma.** A primeira e o "susto de
abertura" — ela precisa assustar. Se alguma estiver feia, vazia ou confusa, me manda que eu ajusto.

**Depois, o video completo** (demora de 15 a 25 minutos):

```powershell
python motor-en\produce.py skills\canal-survival --saida C:\temp\sv
```

Vai aparecer o arquivo `C:\temp\sv\SV001.mp4`. Assista. Confira trez coisas:
a legenda acompanha a voz? o som nao estoura no fim? a historia prende?

Enquanto nao tiver a palavra `--subir` no comando, **nada e enviado ao YouTube**. Pode testar sem medo.

---

## Etapa 5 — Ligar o agendamento (postar sozinho)

Quando o teste estiver bom, a gente liga o despertador. Cole no chat do Crew:

> Copie o arquivo C:\claude-skills\crew\rodar_canal.py para a pasta de receitas do Crew
> (%USERPROFILE%\.kiro\crew\crons\). Depois crie duas tarefas agendadas do tipo script:
> uma chamada "survival" rodando rodar_canal.py:run_survival todo dia as 2h no fuso America/New_York,
> e outra chamada "classics" rodando rodar_canal.py:run_classics todo dia as 4h no mesmo fuso.
> As duas com contexto minimo, sessao nao persistente e prazo de 3600 segundos.
> Depois me mostre a lista de tarefas agendadas.

**Por que produzir de madrugada e publicar de dia?** Porque fazer o video demora uns 20 a 25 minutos, e
nessa hora voce nao esta usando o PC (memoria livre). O video entra **agendado** no YouTube para a hora
certa, entao se der problema ha tempo de consertar antes de ir ao ar.

**Uma parte por noite.** Cada execucao produz **uma** parte, nao a serie toda. Uma serie de 4 partes
sai ao longo de 4 noites. Isso protege duas coisas escassas: a cota de voz do Gemini (compartilhada com
seus canais antigos) e a memoria RAM do seu PC. Os dois canais produzem em horarios diferentes (2h e
4h) para nao disputarem memoria.

**Trava de seguranca:** o video entra no YouTube como **privado com hora marcada**. Voce pode entrar no
YouTube Studio e apagar antes da hora se nao gostar. Voce tem a palavra final sempre.

> ⚠️ **O computador nao pode dormir.** Se o Crew estiver desligado na hora marcada, aquela postagem e
> **perdida** — ele nao repoe depois. Em Configuracoes → Sistema → Energia, deixe "Suspender" em
> "Nunca". Pode desligar a tela, isso nao atrapalha.

---

## Memoria RAM: a regra mais importante do dia a dia

Seu PC tem **8 GB de RAM**. Isso da para fazer os videos, mas **com uma condicao: navegador fechado.**

A conta, com os numeros medidos no seu PC:

| | Memoria |
|---|---|
| Windows, antivirus, area de trabalho | ~2,5 GB |
| Kiro Crew (precisa ficar ligado para o agendamento) | ~0,7 GB |
| **Fazer um video** (Chromium + Whisper + FFmpeg) | **~2 GB** |
| **Soma** | **~5,2 GB de 8 GB** ✅ sobra folga |
| Opera + Chrome abertos | **+4,8 GB** ❌ nao cabe |

Ou seja: **o problema nao e o seu PC, sao os navegadores.** Opera sozinho estava usando 3,3 GB.

**A regra:** feche o Opera e o Chrome antes de dormir. A producao roda as 2h e as 6h da manha, quando
voce nao esta usando o computador — mas navegador nao fecha sozinho. Se ficar aberto, ele continua
ocupando a memoria a noite inteira.

**Protecao automatica:** o programa agora **confere a memoria antes de comecar**. Se tiver menos de
2,5 GB livres, ele nao comeca e escreve `NAO RODEI: memoria insuficiente`, dizendo quais programas
fechar. Isso e melhor que a alternativa: antes, ele trabalharia 20 minutos e seria morto pelo Windows
no meio, sem explicacao nenhuma.

Se um dia quiser mudar esse limite: variavel de ambiente `CANAIS_MIN_RAM_MB`.

### Se ainda faltar memoria

Em ordem, do mais facil para o mais chato:

1. **Fechar os navegadores** (resolve na maioria dos casos)
2. **Desligar o NVIDIA Overlay** e outros programas de bandeja (uns 200 MB cada)
3. **Produzir um canal por noite**, alternando (no `canal.json`, `"fila"` mais alto segura a producao)
4. **Baixar a resolucao** de 1080x1920 para 720x1280 — corta quase metade da memoria do Chromium e
   ainda serve para Shorts. Me peca e eu faco.
5. **Comprar mais 8 GB de RAM.** Pouco romantico, mas e o melhor custo-beneficio: 16 GB resolveria de
   vez e deixaria voce usar o PC normalmente enquanto os videos sao feitos.

## O que fazer quando aparecer uma mensagem

| Mensagem | O que significa | O que fazer |
|---|---|---|
| `AGENDADO SV001 https://...` | ✅ Deu certo, video agendado | Nada |
| `FILA CHEIA` | Ja ha 2 videos esperando a vez | Nada, e normal |
| `SEM ROTEIRO` | Acabaram as historias escritas | Me peca historias novas |
| `CANAL ERRADO` | A chave e do outro canal. **Nada foi enviado** | Confira o `.env` |
| `LEGENDA FORA DA VOZ` | A legenda escorregou do audio | Me manda a mensagem inteira |
| `VOZ FALHOU` | O Gemini nao respondeu agora | Espera e tenta de novo |
| `vencido ou revogado` | A chave do YouTube caducou (7 dias) | Gere outra, ou publique o aplicativo |
| `FUSO NAO ENCONTRADO` | Falta a tabela de fusos | `pip install tzdata` |
| `FALTA A VARIAVEL ...` | Uma chave do `.env` esta em branco | Preencha |
| `NAO RODEI: memoria insuficiente` | Falta RAM livre para comecar | Feche Opera e Chrome e rode de novo |
| `Nao achei o repositorio` | A pasta esta errada ou ainda e `.zip` | Volte ao topo deste manual |

Em qualquer caso: **copie a mensagem e me manda**. Eu conserto.

---

## O que gasta crédito e o que nao gasta

Essa e a parte que resolve seu problema de custo.

| Tarefa | Com que frequencia | Gasta? |
|---|---|---|
| Produzir e postar os videos | todo dia, sozinho | ❌ **Nada** |
| Juntar som, imagem e legenda | todo dia | ❌ **Nada** |
| Conferir se a legenda esta certa | todo dia | ❌ **Nada** |
| Enviar ao YouTube | todo dia | ❌ **Nada** |
| **Escrever historias novas** | 1x por semana, em lote | ✅ **Aqui** |
| **Conferir as imagens de um roteiro novo** | so em roteiro novo | ✅ **Aqui** |

Por que quase tudo e de graca: as tarefas agendadas sao do tipo **"script"** — o Crew so executa um
passo a passo escrito, sem pensar e sem chamar modelo de linguagem. Pensar custa; seguir receita, nao.

**Para gastar o minimo possivel:** me peca historias **em lote**, nunca de uma em uma. Exemplo de pedido:

> Escreva as 3 proximas series do Signal Lost, usando os temas que ja estao marcados como prontos no
> arquivo references/temas.md. Use so as pecas de cena que ja existem, sem criar peca nova.

Tres series de uma vez custa quase o mesmo que uma, porque o trabalho de entender o formato e feito
uma unica vez.

**O que encarece:** pedir **peca de cena nova**. Hoje voce tem 14 pecas prontas (porta, celular,
corredor, relogio, olhos, janela, vela, espelho, estrada, onibus, rio, e mais). Enquanto as historias
usarem so essas, cada video novo e quase gratis. Foi assim que eu escrevi a serie do elevador: zero
codigo novo.

### Quanto conteudo isso consome (e como dobrar depois)

Do jeito que esta agora, **2 videos por dia** = 14 por semana. Em series de 4 partes, isso da umas
**1 a 2 series novas por semana em cada canal**. Da conta tranquilo pedindo em lote uma vez por semana.

Se voce dobrar para 2 por canal (4 por dia), vira **28 por semana** = umas **7 series novas por
semana**. E bem mais escrita, e escrita e a unica coisa que custa credito. Vale dobrar so depois de
saber quais temas funcionam, para nao escrever muito do que o publico nao quer.

**Para dobrar**, no `canal.json` do canal:

```
"horas_locais": [19]          ->   "horas_locais": [12, 19]
"fila": 2                     ->   "fila": 4
```

E um limite tecnico para vigiar quando dobrar: a voz do Gemini no plano gratis da **10 narracoes por
dia, por chave**. Uma serie de 4 partes gasta 4 de uma vez. Com 1 video por dia em cada canal isso nao
chega perto do teto; com 2 em cada, pode chegar. Se estourar, o programa **para sem publicar** e avisa
`VOZ FALHOU`, e no dia seguinte funciona — nao perde nada, so atrasa.

> ⚠️ Use a chave do Gemini da **conta Google nova**. Se reaproveitar a chave dos canais atuais, o
> limite de 10 por dia passa a ser dividido entre todos eles, e os canais que ja funcionam podem
> comecar a falhar. Contas separadas = limites separados.

---

## Como pedir coisas (modelos prontos para copiar)

**Historias novas:**
> Escreva as 3 proximas series do Signal Lost a partir do backlog de references/temas.md, so com as
> pecas de cena que ja existem.

**Ver se esta tudo rodando:**
> Me mostre a lista de tarefas agendadas do Crew e o resultado das ultimas execucoes dos dois canais.

**Quando algo falhar:**
> A tarefa survival falhou. Veja o log da ultima execucao e conserte.

**Depois de uns 30 dias, para o ciclo de aprendizado:**
> Pegue os numeros dos dois canais no YouTube dos ultimos 30 dias, veja quais temas e formatos foram
> melhores, e escreva as proximas historias parecidas com as que foram bem.

---

## O que ainda nao esta pronto

Coisas que combinamos deixar para depois, para nao atrasar o comeco:

1. **Video longo** a partir das partes. As series ja sao feitas para grudar em ordem — falta escrever o
   programinha que junta. E o proximo passo depois de os canais estarem publicando sozinhos.
2. **Pecas de cena de mar e antiguidade** (navio, caverna, templo). Sem elas, o canal de classicos
   comeca pelos classicos escuros (Macbeth, Poe, Hamlet), que cabem nas pecas atuais.
3. **Relatorio automatico de desempenho.** O canal radar-da-gringa ja tem um pronto
   (`aprendizado.py`); da para adaptar quando os canais novos tiverem uns 30 dias de numeros.
4. **Instagram.** Fica para depois: o Instagram nao aceita receber o arquivo de video direto, exige que
   o video ja esteja numa pagina publica da internet.
