(async () => {
    console.log("Label Automation Script started via InjectJS...");

    const currentUrl = window.location.href;
    const origin = window.location.origin;
    const targetSize = 72; // Tamanho do QR code reduzido em 10%
    let qrSrc = "";

    // Variáveis persistentes para reter os últimos valores válidos de Ref e Produto
    let lastValidRef = "";
    let lastValidProduto = "";

// Função Inteligente para truncar no meio sem quebrar palavras (Estilo Finder Avançado)
const formatClienteFinderStyle = (text, maxLength = 66) => {
    if (!text || text.length <= maxLength) return text;

    // Espaço real disponível para as letras (descontando os "...")
    const targetLength = maxLength - 3;
    const words = text.split(" ");
    
    let startStr = "";
    let endStr = "";
    
    // Distribuímos o peso ideal: um pouco mais de prioridade para o início do nome
    const idealStartLength = Math.ceil(targetLength * 0.55);
    const idealEndLength = targetLength - idealStartLength;

    // 1. Monta o Início com palavras completas
    let currentStartLength = 0;
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        // Verifica se a palavra cabe sem estourar o limite ideal
        if (currentStartLength + word.length + (startStr ? 1 : 0) <= idealStartLength) {
            startStr += (startStr ? " " : "") + word;
            currentStartLength = startStr.length;
        } else {
            // FALLBACK SE A PALAVRA FOR GIGANTE (Ex: LIVRAMENTO)
            // Se não pegou quase nada do início, corta a palavra mantendo o começo dela
            if (startStr.length < idealStartLength * 0.6) {
                const remainingSpace = idealStartLength - startStr.length - (startStr ? 1 : 0);
                if (remainingSpace > 3) {
                    startStr += (startStr ? " " : "") + word.substring(0, remainingSpace);
                }
            }
            break;
        }
    }

    // 2. Monta o Fim com palavras completas (de trás para frente)
    let currentEndLength = 0;
    const maxAllowedEndLength = targetLength - startStr.length;

    for (let i = words.length - 1; i >= 0; i--) {
        const word = words[i];
        // Se a palavra já foi usada no início, não repete
        if (startStr.includes(word) && text.indexOf(word) < startStr.length) {
            break;
        }

        if (currentEndLength + word.length + (endStr ? 1 : 0) <= maxAllowedEndLength) {
            endStr = word + (endStr ? " " : "") + endStr;
            currentEndLength = endStr.length;
        } else {
            break;
        }
    }

    // Remove espaços extras nas pontas antes de juntar
    startStr = startStr.trim();
    endStr = endStr.trim();

    return `${startStr}...${endStr}`;
};
    // =========================================================================
    // STEP 1: Gerador de QR Code com Dupla Camada (API -> Fallback Local)
    // =========================================================================
    try {
        console.log("Tentando gerar QR Code via api.qrserver.com...");
        qrSrc = await new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                img.onload = null;
                img.onerror = null;
                reject(new Error("api.qrserver.com expirou após 3500ms"));
            }, 3500);

            img.onload = () => {
                clearTimeout(timeout);
                resolve(img.src);
            };

            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error("Falha na rede ao chamar api.qrserver.com"));
            };

            img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${targetSize}x${targetSize}&data=${encodeURIComponent(currentUrl)}`;
        });
        console.log("QR Code carregado com sucesso do servidor da API.");
    } 
    catch (apiError) {
        console.warn(apiError.message);
        console.log("Alternando para o método de contingência: qrcode.js...");

        try {
            if (!window.QRCode) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
                    
                    const timeout = setTimeout(() => {
                        script.onload = null;
                        script.onerror = null;
                        reject(new Error("Injeção do qrcode.js expirou após 3500ms"));
                    }, 3500);

                    script.onload = () => {
                        clearTimeout(timeout);
                        resolve();
                    };

                    script.onerror = () => {
                        clearTimeout(timeout);
                        reject(new Error("Falha ao carregar o script qrcode.js"));
                    };

                    document.head.appendChild(script);
                });
            }

            const qrContainer = document.createElement('div');
            new window.QRCode(qrContainer, {
                text: currentUrl,
                width: targetSize,
                height: targetSize,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: window.QRCode.CorrectLevel.H
            });

            qrSrc = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    clearInterval(interval);
                    reject(new Error("Renderização do qrcode.js expirou após 3500ms"));
                }, 3500);

                const interval = setInterval(() => {
                    const qrImgElement = qrContainer.querySelector('img');
                    const qrCanvasElement = qrContainer.querySelector('canvas');
                    
                    if (qrImgElement && qrImgElement.src && qrImgElement.src.startsWith('data:')) {
                        clearTimeout(timeout);
                        clearInterval(interval);
                        resolve(qrImgElement.src);
                    } else if (qrCanvasElement) {
                        clearTimeout(timeout);
                        clearInterval(interval);
                        resolve(qrCanvasElement.toDataURL());
                    }
                }, 100);
            });
            console.log("QR Code em Base64 local gerado com sucesso.");
        } catch (fallbackError) {
            console.error("Ambos os métodos de QR Code falharam:", fallbackError.message);
            qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${targetSize}x${targetSize}&data=${encodeURIComponent(currentUrl)}`;
        }
    }

    const qrHtml = `
        <div style="display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; text-align: center;">
            <img src="${qrSrc}" style="width: ${targetSize}px; height: ${targetSize}px; display: block; margin: 0 auto;" />
        </div>
    `.trim();

    // =========================================================================
    // STEP 2: Coleta e Sincronização de Dados da Tela Atual
    // =========================================================================
    const btn = document.querySelector('a[data-bind*="CarregarProdutos"]');
    if (btn) {
        btn.click();
        console.log("Atualizando a grade de produtos. Aguardando 3 segundos...");
        await new Promise(r => setTimeout(r, 3000));
    }

    const allRows = Array.from(document.querySelectorAll("#grid-produtos > tbody > tr"));
    const dataRows = allRows.filter(tr => tr.querySelector('[data-index="3"]') || tr.querySelector('td.coluna-produto'));

    if (dataRows.length === 0) {
        alert("Nenhum produto foi localizado na tabela '#grid-produtos'. Certifique-se de que a grade foi carregada.");
        return;
    }

    const anchorElement = document.querySelector('a[href*="#editar/"]'); 
    const rawHref = anchorElement ? anchorElement.getAttribute('href') : ""; 
    const idMatch = rawHref ? rawHref.match(/#editar\/(\d+)/) : null;
    const idPedido = idMatch ? idMatch[1] : "";
    const fetchUrlCliente = `${origin}/admin/pedidovenda/editar?id=${idPedido}`;

    let cliente = "";
    if (idPedido) {
        try {
            const resCliente = await fetch(fetchUrlCliente, { method: "GET", credentials: "include" });
            const htmlCliente = await resCliente.text();
            const match = htmlCliente.match(/IdPessoaSelect2"\s*:\s*\{\s*"id"\s*:\s*\d+,\s*"text"\s*:\s*"([^"]+)"/);
            cliente = match ? match[1] : "";
        } catch (err) {
            console.error("Falha ao processar dados do cliente:", err);
        }
    }

    // --- Código adicionado abaixo ---
    if (cliente && cliente.includes(" - ")) {
        const ultimoTraco = cliente.lastIndexOf(" - ");
        cliente = cliente.substring(0, ultimoTraco);
    }

    // Aplica a redução dinâmica no nome do cliente (Máximo 55 caracteres com corte central)
    const clienteFormatado = cliente;

    // Baixar o template Etiqueta2 do GitHub
    const urlTemplate = `https://raw.githubusercontent.com/welliton-insight/html-label-dapic-prod/main/Etiqueta-camisa-basica-p4.html?t=${new Date().getTime()}`;
    const resTemplate = await fetch(urlTemplate);
    const buffer = await resTemplate.arrayBuffer();
    const decoder = new TextDecoder("utf-8");
    let htmlTemplate = decoder.decode(buffer);

    // CORREÇÃO CRÍTICA: Remove comentários condicionais do Excel que quebram o DOMParser
    htmlTemplate = htmlTemplate.replace(/<!\[if [^\]]+\]>([\s\S]*?)<!\[endif\]>/g, '$1');

    const today = new Date().toLocaleDateString("pt-BR");
    const previsao = document.querySelector("#DataPrevisaoManual")?.value || "";

    const empresaFull = document
        .querySelector("#main > div.conteudo > div.centro-conteudo > div.descricao-topo.tela.carregou > div.empresa-logada > div.dados-empresa-logada > div > div > span")
        ?.textContent.trim() || "";
    const empresa = empresaFull.split(" ")[0] || "";

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlTemplate, "text/html");
    const templateTable = doc.querySelector("table");

    if (!templateTable) {
        alert("Nenhuma tabela <table> encontrada no template HTML pós-limpeza. Verifique o arquivo.");
        return;
    }

    const tableHTMLString = templateTable.outerHTML;
    let allTablesHTML = "";

    // =========================================================================
    // STEP 3: Loop Principal pelas Linhas via Ficha Técnica
    // =========================================================================
    for (let i = 0; i < dataRows.length; i++) {
        const tr = dataRows[i];
        let productId = "";

        try {
            if (typeof ko !== 'undefined') {
                const koData = ko.dataFor(tr) || ko.dataFor(tr.querySelector('td'));
                if (koData) {
                    productId = typeof koData.Id === 'function' ? koData.Id() : koData.Id;
                }
            }
        } catch (e) {}

        if (!productId) {
            productId = tr.getAttribute("data-id") || 
                        tr.getAttribute("data-row-id") || 
                        tr.id?.match(/\d+/)?.[0] || 
                        tr.querySelector('input[type="checkbox"]')?.value;
        }

        const rowTecidos = [];
        const rowLinhas = [];
        const rowFios = [];

        if (productId) {
            try {
                const resFicha = await fetch(`${origin}/admin/fichatecnicaprodutoordemproducao/carregar?idProdutoOrdemProducao=${productId}`, {
                    method: "GET",
                    credentials: "include"
                });
                const fichaJson = await resFicha.json();

                if (fichaJson && Array.isArray(fichaJson.FichasTecnicas)) {
                    fichaJson.FichasTecnicas.forEach(ft => {
                        if (Array.isArray(ft.Consumos)) {
                            ft.Consumos.forEach(c => {
                                const referencia = c.Referencia ? c.Referencia.trim() : "";
                                const descricao = c.Descricao ? c.Descricao.trim() : "";
                                const cor = c.DescricaoCor ? c.DescricaoCor.trim() : "";

                                const refUpper = referencia.toUpperCase();
                                const descUpper = descricao.toUpperCase();

                                const formattedString = `<span style="font-size: 80%;">${referencia} - ${descricao} - ${cor}</span>`;

                                if (refUpper.startsWith("TECIDO") || descUpper.startsWith("TECIDO") || refUpper.startsWith("MP.R")) {
                                    rowTecidos.push(formattedString);
                                } else if (refUpper.startsWith("LINHA") || refUpper.includes(".L") || refUpper.includes("MP.L")) { 
                                    rowLinhas.push(formattedString);
                                } else if (refUpper.startsWith("FIO") || refUpper.includes(".F") || refUpper.includes("MP.F")) { 
                                    rowFios.push(formattedString);
                                }
                            });
                        }
                    });
                }
            } catch (fichaErr) {
                console.error(`Erro ao carregar Ficha Técnica para o produto ID ${productId}:`, fichaErr);
            }
        }

        // Captura e tratamento com Fallback para Ref e Produto
        let currentRef = "";
        let currentProduto = "";
        const productTd = tr.querySelector("td.coluna-produto");
        if (productTd) {
            const span = productTd.querySelector("span");
            if (span) {
                const b = span.querySelector("b");
                currentRef = b ? b.textContent.trim() : "";
                let full = span.textContent || "";
                currentProduto = full.replace(currentRef, "").replace("-", "").trim();
            }
        }

        // Lógica de fallback estável
        if (currentRef) {
            lastValidRef = currentRef;
        } else {
            currentRef = lastValidRef;
        }

        if (currentProduto) {
            lastValidProduto = currentProduto;
        } else {
            currentProduto = lastValidProduto;
        }

        const T = tr.querySelector('td[data-index="3"] > span')?.textContent.trim() || "";
        const lote = tr.querySelector('td[data-index="4"]')?.textContent.trim() || "";
        const cod = tr.querySelector('td[data-index="5"]')?.textContent.trim() || "";
        const Qtd = tr.querySelector('td[data-index="6"]')?.textContent.trim() || "";
        const OP = empresa && cod ? `${empresa} - ${cod}` : cod;
        const clienteFormatado = formatClienteFinderStyle(cliente, 66);
        // Dicionário de tags base comuns (Usa o clienteFormatado com tratamento anti-quebra)
        const tags = {
            "#Cliente": cliente,
            "#Responsavel": "EUGENIO",
            "#Emissao": today,
            "#Previsao": previsao,
            "#T": T,
            "#Qtd": Qtd,
            "#OP": OP,
            "#Lote": lote,
            "#Ref": currentRef,
            "#Produto": currentProduto,
            "#QR": qrHtml
        };

        // GERAÇÃO DAS PILHAS (STACKS):
        const tecidosStack = rowTecidos.join("<br />");
        const linhasStack = rowLinhas.join("<br />");
        const fiosStack = rowFios.join("<br />");

        tags["#Tecido"] = tecidosStack || "";
        tags["#tecido"] = tecidosStack || "";
        
        tags["#Linha1"] = rowLinhas[0] || "";
        tags["#Linha2"] = rowLinhas[1] || rowLinhas[0] || ""; 
        tags["#Linha"] = linhasStack || "";
        tags["#linha"] = linhasStack || "";

        tags["#Fio"] = fiosStack || "";
        tags["#fio"] = fiosStack || "";

        // Executar substituição textual completa na estrutura do template
        let currentTableHTML = tableHTMLString;
        for (const [tag, value] of Object.entries(tags)) {
            currentTableHTML = currentTableHTML.replaceAll(tag, value);
        }

        // Limpeza de segurança para remover placeholders não preenchidos
        currentTableHTML = currentTableHTML.replace(/#(tecido|Linha|Fio|linha|fio|Tecido)\d*/g, "");

        // Mantém o empilhamento contínuo sem forçar quebras ou limpezas severas
        allTablesHTML += `<div class="etiqueta-container" style="display: block !important; margin-bottom: 0px !important; padding-bottom: 5px !important;">${currentTableHTML}</div>`;
    }
        
    templateTable.outerHTML = allTablesHTML;

    // Ajustes de impressão em tamanho de página A4
    const stylePrint = doc.createElement("style");
    stylePrint.textContent = `
        @page { size: A4 portrait; margin: 0.5cm 0.5cm 0.5cm 0.4cm; }
        @media print {
            html, body { 
                display: block !important; 
                float: none !important;
                position: relative !important;
                zoom: 96%;
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
            }
            
            .etiqueta-container {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: auto !important;
                break-after: auto !important;
            }

            table, tr, td {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            
            table {
                display: table !important;
                float: none !important;
                margin-bottom: 0px !important;
            }
        }
    `;
    doc.head.appendChild(stylePrint);

    // =========================================================================
    // STEP 4: Instanciação e Disparo da Impressão
    // =========================================================================
    console.log("Abrindo janela de visualização de impressão final...");
    const finalHtml = doc.documentElement.outerHTML;
    const w = window.open();
    if (!w) {
        alert("O bloqueador de pop-ups impediu a abertura da janela. Por favor, autorize pop-ups para este site.");
        return;
    }
    
    w.document.open();
    w.document.write(finalHtml);
    w.document.close();

    setTimeout(() => {
        w.print();
    }, 500);
})();
