// Adiciona o aviso visual dinamicamente abaixo das estrelas (agora bonitão)
    let warningText = document.getElementById('album-rating-warning');
    if (!warningText) {
        const starsContainer = document.getElementById('album-view-stars').parentElement;
        warningText = document.createElement('div');
        warningText.id = 'album-rating-warning';
        
        // Estilização injetada via JS pra ficar com cara de painel
        warningText.style.marginTop = '15px';
        warningText.style.padding = '12px 15px';
        warningText.style.borderRadius = '10px';
        warningText.style.background = 'rgba(255, 255, 255, 0.05)';
        warningText.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        warningText.style.display = 'flex';
        warningText.style.gap = '10px';
        warningText.style.alignItems = 'flex-start';
        warningText.style.maxWidth = '420px';

        warningText.innerHTML = `
            <i class="ph ph-info" style="color: #aaa; font-size: 1.2rem; margin-top: 2px;"></i>
            <div>
                <p style="color:#fff; font-size:0.75rem; font-weight:600; margin-bottom: 4px;">Avaliação Rápida</p>
                <p style="color:#aaa; font-size:0.65rem; line-height: 1.4;">A nota dada aqui será distribuída para todas as faixas. Para uma curadoria precisa, avalie as músicas individualmente abaixo.</p>
            </div>
        `;
        starsContainer.parentElement.appendChild(warningText);
    }
