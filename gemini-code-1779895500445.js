(async () => {
    console.log("Label Automation Script started...");

    const currentUrl = window.location.href;
    const targetSize = 72; // 10% reduced fit size (72x72)
    let qrSrc = "";

    // =========================================================================
    // STEP 1: Dual-Layered Ordered QR Code Generation Engine
    // =========================================================================
    
    // Method A: api.qrserver.com (Primary)
    try {
        console.log("Attempting QR generation via api.qrserver.com...");
        qrSrc = await new Promise((resolve, reject) => {
            const img = new Image();
            
            const timeout = setTimeout(() => {
                img.onload = null;
                img.onerror = null;
                reject(new Error("api.qrserver.com timed out after 3500ms"));
            }, 3500);

            img.onload = () => {
                clearTimeout(timeout);
                resolve(img.src);
            };

            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error("api.qrserver.com network request failed (likely CSP blocked)"));
            };

            img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${targetSize}x${targetSize}&data=${encodeURIComponent(currentUrl)}`;
        });
        console.log("Successfully loaded QR from API server.");
    } 
    // Method B: qrcode.js (Fallback)
    catch (apiError) {
        console.warn(apiError.message);
        console.log("Switching to fallback method: qrcode.js...");

        try {
            // Ensure qrcode.js is available on the window object
            if (!window.QRCode) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
                    
                    const timeout = setTimeout(() => {
                        script.onload = null;
                        script.onerror = null;
                        reject(new Error("qrcode.js library load timed out after 3500ms"));
                    }, 3500);

                    script.onload = () => {
                        clearTimeout(timeout);
                        console.log("qrcode.js script file injected successfully.");
                        resolve();
                    };

                    script.onerror = () => {
                        clearTimeout(timeout);
                        reject(new Error("Failed to inject qrcode.js script file"));
                    };

                    document.head.appendChild(script);
                });
            }

            // Create temporary container to compile canvas/image
            const qrContainer = document.createElement('div');
            new window.QRCode(qrContainer, {
                text: currentUrl,
                width: targetSize,
                height: targetSize,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: window.QRCode.CorrectLevel.H
            });

            // Poll the container to extract the generated image source
            qrSrc = await new Promise((resolve, reject) => {
                const startTime = Date.now();
                
                const timeout = setTimeout(() => {
                    clearInterval(interval);
                    reject(new Error("qrcode.js rendering timed out after 3500ms"));
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
            console.log("Successfully generated local base64 fallback QR.");
        } catch (fallbackError) {
            console.error("Both QR methods failed or timed out:", fallbackError.message);
            // Safety parachute URL: sets target string to API structure so code execution doesn't halt completely
            qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${targetSize}x${targetSize}&data=${encodeURIComponent(currentUrl)}`;
        }
    }

    // Centered table layout template for the extracted source
    const qrHtml = `
        <div style="display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; text-align: center;">
            <img src="${qrSrc}" style="width: ${targetSize}px; height: ${targetSize}px; display: block; margin: 0 auto;" />
        </div>
    `.trim();


    // =========================================================================
    // STEP 2: Main Application Interface Scraping
    // =========================================================================
    const btn = document.querySelector('a[data-bind*="CarregarProdutos"]');
    if (btn) {
        btn.click();
        console.log("Refreshing system products grid. Pausing workflow for 3000ms...");
        await new Promise(r => setTimeout(r, 3000));
    }

    // Collect targeted system records
    const anchorElement = document.querySelector('a[href*="#editar/"]'); 
    const origin = window.location.origin; 
    const rawHref = anchorElement ? anchorElement.getAttribute('href') : ""; 

    const idMatch = rawHref ? rawHref.match(/#editar\/(\d+)/) : null;
    const id = idMatch ? idMatch[1] : "";
    const fetchUrl = `${origin}/admin/pedidovenda/editar?id=${id}`;

    let cliente = "";
    if (id) {
        try {
            const resCliente = await fetch(fetchUrl, { method: "GET", credentials: "include" });
            const htmlCliente = await resCliente.text();
            const match = htmlCliente.match(/IdPessoaSelect2"\s*:\s*\{\s*"id"\s*:\s*\d+,\s*"text"\s*:\s*"([^"]+)"/);
            cliente = match ? match[1] : "";
        } catch (err) {
            console.error("Failed to parse client records:", err);
        }
    }

    // Fetch master label document template layout from Github distribution
    const url = `https://raw.githubusercontent.com/welliton-insight/html-label-dapic-prod/main/Etiqueta-camisa-basica-v2-p4.html?t=${new Date().getTime()}`;
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder("utf-8");
    const htmlTemplate = decoder.decode(buffer);

    // Context metadata strings
    const today = new Date().toLocaleDateString("pt-BR");
    const previsao = document.querySelector("#DataPrevisaoManual")?.value || "";

    const empresaFull = document
        .querySelector("#main > div.conteudo > div.centro-conteudo > div.descricao-topo.tela.carregou > div.empresa-logada > div.dados-empresa-logada > div > div > span")
        ?.textContent.trim() || "";
    const empresa = empresaFull.split(" ")[0] || "";

    const allRows = Array.from(document.querySelectorAll("#grid-produtos > tbody > tr"));
    const dataRows = allRows.filter(tr => tr.querySelector('[data-index="3"]'));

    let amount = dataRows.length; 
    const paginationSpan = document.querySelector("#grid-produtos > tfoot > tr > td > div.neuegrid-pagination > span.records-position");
    if (paginationSpan) {
        const parts = paginationSpan.textContent.split("de");
        if (parts.length > 1) {
            amount = parseInt(parts[1].trim(), 10) || amount;
        }
    }

    const rowsToProcess = dataRows.slice(0, amount);

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlTemplate, "text/html");
    const templateTable = doc.querySelector("table");

    if (!templateTable) {
        alert("Nenhuma tabela <table> encontrada no template HTML.");
        return;
    }

    const tableHTMLString = templateTable.outerHTML;
    let allTablesHTML = "";
    let currentRef = "";
    let currentProduto = "";

    // Parse loop array data mappings
    for (const tr of rowsToProcess) {
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

        const T = tr.querySelector('td[data-index="3"] > span')?.textContent.trim() || "";
        const lote = tr.querySelector('td[data-index="4"]')?.textContent.trim() || "";
        const cod = tr.querySelector('td[data-index="5"]')?.textContent.trim() || "";
        const Qtd = tr.querySelector('td[data-index="6"]')?.textContent.trim() || "";
        const OP = empresa && cod ? `${empresa} - ${cod}` : cod;

        const tags = {
            "#Cliente": `<span style="font-size:90%">${cliente}</span>`,
            "#Responsavel": "EUGENIO",
            "#Emissao": today,
            "#Previsao": previsao,
            "#T": T,
            "#Qtd": Qtd,
            "#OP": OP,
            "#Lote": lote,
            "#Ref": currentRef,
            "#Produto": `<span style="font-size:90%">${currentProduto}</span>`,
            "#QR": qrHtml 
        };

        let currentTableHTML = tableHTMLString;
        for (const [tag, value] of Object.entries(tags)) {
            currentTableHTML = currentTableHTML.replaceAll(tag, value);
        }
        allTablesHTML += currentTableHTML;
    }

    templateTable.outerHTML = allTablesHTML;

    // Inject scaling rules styles
    const stylePrint = doc.createElement("style");
    stylePrint.textContent = `
        @page { size: A4 portrait; margin: 0.5cm; }
        @media print {
            body { zoom: 82%; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    `;
    doc.head.appendChild(stylePrint);


    // =========================================================================
    // STEP 3: Safe Window Initialization (Only triggers once QR logic is complete)
    // =========================================================================
    console.log("Opening compilation presentation output window...");
    const finalHtml = doc.documentElement.outerHTML;
    const w = window.open();
    if (!w) {
        alert("O bloqueador de pop-ups impediu a janela de impressão. Por favor, autorize pop-ups para este site.");
        return;
    }
    
    w.document.open();
    w.document.write(finalHtml);
    w.document.close();

    setTimeout(() => {
        w.print();
    }, 500);
})();