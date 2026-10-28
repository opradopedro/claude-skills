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
| `GEMINI_API_KEY` | aistudio.google.com → "Get API key". E a voz da narracao. De graca. |
| `YT_CLIENT_ID` e `YT_CLIENT_SECRET` | console.cloud.google.com → novo projeto → ative a "YouTube Data API v3" → crie uma credencial OAuth do tipo "Aplicativo da Web". **Um par só, serve para os dois canais.** |
| `YT_REFRESH_TOKEN_SURVIVAL` | developers.google.com/oauthplayground, entrando com o **canal 1** |
| `YT_REFRESH_TOKEN_CLASSICS` | o mesmo, entrando com o **canal 2** |

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
> e outra chamada "classics" rodando rodar_canal.py:run_classics todo dia as 6h no mesmo fuso.
> As duas com contexto minimo, sessao nao persistente e prazo de 10800 segundos.
> Depois me mostre a lista de tarefas agendadas.

**Por que produzir de madrugada e publicar de dia?** Porque fazer o video demora. Cada parte leva de 15
a 25 minutos, e o programa produz a serie **inteira** de uma vez — uma serie de 4 partes passa de uma
hora de computador. Produzindo as 2h e as 6h de Nova York, os dois canais nao se atropelam e sobra
folga ate a primeira publicacao do meio-dia. O video entra **agendado** no YouTube para a hora certa,
entao se der problema ha tempo de consertar antes de ir ao ar.

**Trava de seguranca:** o video entra no YouTube como **privado com hora marcada**. Voce pode entrar no
YouTube Studio e apagar antes da hora se nao gostar. Voce tem a palavra final sempre.

> ⚠️ **O computador nao pode dormir.** Se o Crew estiver desligado na hora marcada, aquela postagem e
> **perdida** — ele nao repoe depois. Em Configuracoes → Sistema → Energia, deixe "Suspender" em
> "Nunca". Pode desligar a tela, isso nao atrapalha.

---

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
