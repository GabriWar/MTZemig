document.addEventListener('DOMContentLoaded', () => {
  const accountList = document.getElementById('account-list');
  const addForm = document.getElementById('add-account-form');
  const showAddBtn = document.getElementById('show-add-form-btn');
  const saveBtn = document.getElementById('save-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const capturedSection = document.getElementById('captured-data-section');
  const copyJsonBtn = document.getElementById('copy-json-btn');
  const descontoInput = document.getElementById('desconto');
  const tipoLigacaoSelect = document.getElementById('tipo-ligacao');
  const generateDocBtn = document.getElementById('generate-doc-btn');
  const formTitle = document.getElementById('form-title');

  let currentBillData = null;
  let editingUser = null; // Track which account is being edited

  loadAccounts();
  loadCapturedData();
  setupGenerateDocument();

  descontoInput?.addEventListener('input', () => {
    if (currentBillData) updateCalculations();
  });

  tipoLigacaoSelect?.addEventListener('change', () => {
    if (currentBillData) updateCalculations();
  });

  copyJsonBtn?.addEventListener('click', () => {
    if (currentBillData) {
      navigator.clipboard.writeText(JSON.stringify(currentBillData, null, 2))
        .then(() => {
          copyJsonBtn.textContent = 'Copiado!';
          setTimeout(() => copyJsonBtn.textContent = 'Copiar', 2000);
        });
    }
  });

  showAddBtn.addEventListener('click', () => {
    editingUser = null; // Clear edit mode
    clearForm();
    if (formTitle) formTitle.textContent = 'Nova Conta';
    addForm.classList.remove('hidden');
    showAddBtn.classList.add('hidden');
  });

  cancelBtn.addEventListener('click', () => {
    editingUser = null; // Clear edit mode
    if (formTitle) formTitle.textContent = 'Nova Conta';
    addForm.classList.add('hidden');
    showAddBtn.classList.remove('hidden');
    clearForm();
  });

  saveBtn.addEventListener('click', () => {
    const user = usernameInput.value.trim();
    const pass = passwordInput.value.trim();
    if (!user || !pass) {
      alert('Por favor, preencha usuário e senha.');
      return;
    }

    // Collect all customer data
    const accountData = {
      user,
      pass,
      nome: document.getElementById('acc-nome')?.value.trim() || '',
      cnpj: document.getElementById('acc-cnpj')?.value.trim() || '',
      endereco: document.getElementById('acc-endereco')?.value.trim() || '',
      instalacao: document.getElementById('acc-instalacao')?.value.trim() || '',
      tipoLigacao: document.getElementById('acc-tipo')?.value || '100',
      desconto: document.getElementById('acc-desconto')?.value || '30'
    };

    saveAccount(accountData);
  });

  function loadAccounts() {
    chrome.storage.local.get(['cemigAccounts'], (result) => {
      renderAccounts(result.cemigAccounts || []);
    });
  }

  function saveAccount(accountData) {
    chrome.storage.local.get(['cemigAccounts'], (result) => {
      let accounts = result.cemigAccounts || [];
      
      if (editingUser !== null) {
        // Edit mode: remove old account and add updated one
        accounts = accounts.filter(a => a.user !== editingUser);
        accounts.push(accountData);
      } else {
        // Add mode: check if username already exists
        const idx = accounts.findIndex(a => a.user === accountData.user);
        if (idx >= 0) {
          accounts[idx] = accountData; // Update all fields
        } else {
          accounts.push(accountData);
        }
      }
      
      chrome.storage.local.set({ cemigAccounts: accounts }, () => {
        editingUser = null; // Clear edit mode
        loadAccounts();
        addForm.classList.add('hidden');
        showAddBtn.classList.remove('hidden');
        clearForm();
      });
    });
  }

  function deleteAccount(user) {
    if (confirm(`Remover conta ${user}?`)) {
      chrome.storage.local.get(['cemigAccounts'], (result) => {
        const newAccounts = (result.cemigAccounts || []).filter(a => a.user !== user);
        chrome.storage.local.set({ cemigAccounts: newAccounts }, loadAccounts);
      });
    }
  }

  function editAccount(account) {
    editingUser = account.user; // Set edit mode
    
    // Update form title
    if (formTitle) formTitle.textContent = 'Editar Conta';
    
    // Fill form with account data
    usernameInput.value = account.user || '';
    passwordInput.value = account.pass || '';
    document.getElementById('acc-nome').value = account.nome || '';
    document.getElementById('acc-cnpj').value = account.cnpj || '';
    document.getElementById('acc-endereco').value = account.endereco || '';
    document.getElementById('acc-instalacao').value = account.instalacao || '';
    document.getElementById('acc-tipo').value = account.tipoLigacao || '100';
    document.getElementById('acc-desconto').value = account.desconto || '30';
    
    // Show form
    addForm.classList.remove('hidden');
    showAddBtn.classList.add('hidden');
  }

  function renderAccounts(accounts) {
    accountList.innerHTML = accounts.length === 0
      ? '<p style="text-align:center; color:#888;">Nenhuma conta salva.</p>'
      : '';
    accounts.forEach(acc => {
      const item = document.createElement('div');
      item.className = 'account-item';
      item.style.cursor = 'pointer';
      item.title = 'Clique para preencher dados e autofill';
      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn') || e.target.closest('.edit-btn')) return;

        // Fill customer data in the document section
        document.getElementById('cliente-nome').value = acc.nome || '';
        document.getElementById('cliente-cnpj').value = acc.cnpj || '';
        document.getElementById('cliente-endereco').value = acc.endereco || '';
        document.getElementById('n-instalacao').value = acc.instalacao || '';

        // Fill tipo ligação and desconto
        if (tipoLigacaoSelect) tipoLigacaoSelect.value = acc.tipoLigacao || '100';
        if (descontoInput) descontoInput.value = acc.desconto || '30';

        // Trigger recalculation
        if (currentBillData) updateCalculations();

        // Send autofill to page
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'fill_creds', user: acc.user, pass: acc.pass });
        });
      });

      // Show nome if available, otherwise just user
      const displayName = acc.nome || acc.user;
      const subInfo = acc.nome ? acc.user : '••••••••';

      item.innerHTML = `
        <div class="account-info">
          <div class="account-user">${displayName}</div>
          <div class="account-pass">${subInfo}</div>
        </div>
        <div class="account-actions">
          <button class="edit-btn" title="Editar">Editar</button>
          <button class="delete-btn" title="Remover">&times;</button>
        </div>
      `;
      item.querySelector('.edit-btn').onclick = (e) => { e.stopPropagation(); editAccount(acc); };
      item.querySelector('.delete-btn').onclick = (e) => { e.stopPropagation(); deleteAccount(acc.user); };
      accountList.appendChild(item);
    });
  }

  function clearForm() {
    usernameInput.value = '';
    passwordInput.value = '';
    document.getElementById('acc-nome').value = '';
    document.getElementById('acc-cnpj').value = '';
    document.getElementById('acc-endereco').value = '';
    document.getElementById('acc-instalacao').value = '';
    document.getElementById('acc-tipo').value = '100';
    document.getElementById('acc-desconto').value = '30';
  }

  function loadCapturedData() {
    chrome.storage.local.get(['lastCapturedBill'], (result) => {
      if (result.lastCapturedBill?.data?.billDetails?.bills?.[0]) {
        capturedSection.classList.remove('hidden');
        currentBillData = result.lastCapturedBill;
        updateCalculations();
        document.getElementById('json-full').textContent = JSON.stringify(currentBillData, null, 2);
      }
    });
  }

  function updateCalculations() {
    const bill = currentBillData.data.billDetails.bills[0];

    // Header
    document.getElementById('bill-header').innerHTML = `
      <div class="bill-info">
        <span class="bill-month">${bill.referenceMonth}</span>
        <span class="bill-due">Venc: ${new Date(bill.dueDate).toLocaleDateString('pt-BR')}</span>
      </div>
      <div class="bill-value">R$ ${formatCurrency(bill.value)}</div>
    `;

    // Check if it's a GD account
    const isGD = checkIfGD(bill);
    const extracted = extractBillData(bill);

    if (!isGD) {
      // Not a GD account - show message
      document.getElementById('extracted-data').innerHTML = `
        <div class="data-item full-width">
          <span class="data-label warning">⚠️ Esta conta NÃO possui Geração Distribuída (GD)</span>
          <span class="data-value">Os cálculos MTZ não se aplicam a esta conta.</span>
        </div>
        <div class="data-item">
          <span class="data-label">Consumo</span>
          <span class="data-value">${bill.consumption?.toLocaleString('pt-BR')} kWh</span>
        </div>
        <div class="data-item">
          <span class="data-label">Tarifa</span>
          <span class="data-value">${extracted.tarifaEnergia?.toFixed(8) || 'N/A'}</span>
        </div>
      `;
      document.getElementById('summary-data').innerHTML = `
        <div class="data-item">
          <span class="data-label">Iluminação Pública</span>
          <span class="data-value">R$ ${formatCurrency(extracted.iluminacaoPublica)}</span>
        </div>
        <div class="data-item">
          <span class="data-label">Valor da Conta</span>
          <span class="data-value highlight">R$ ${formatCurrency(bill.value)}</span>
        </div>
      `;
      document.getElementById('discount-data').innerHTML = `
        <div class="data-item full-width">
          <span class="data-value" style="color: #888;">Cálculos não disponíveis para contas sem GD</span>
        </div>
      `;
      return;
    }

    // GD Account - show full calculations
    document.getElementById('extracted-data').innerHTML = `
      <div class="data-item">
        <span class="data-label" title="Custo de Disponibilidade / Fator">Tarifa B1</span>
        <span class="data-value">${extracted.tarifaB1}</span>
      </div>
      <div class="data-item">
        <span class="data-label" title="kWh compensados pela GD">Consumo Abatido GD</span>
        <span class="data-value">${extracted.consumoGD.toLocaleString('pt-BR')} kWh</span>
      </div>
      <div class="data-item">
        <span class="data-label">Iluminação Pública</span>
        <span class="data-value">R$ ${formatCurrency(extracted.iluminacaoPublica)}</span>
      </div>
      <div class="data-item">
        <span class="data-label" title="Juros, multas e cobranças">Multas/Cobranças</span>
        <span class="data-value">R$ ${formatCurrency(extracted.multas)}</span>
      </div>
    `;

    // Usar função centralizada de cálculo
    const descontoPercent = parseFloat(descontoInput?.value || 30);
    const calc = calculateAll(extracted, bill.value, descontoPercent);

    document.getElementById('summary-data').innerHTML = `
      <div class="data-item">
        <span class="data-label" title="CONSUMO × TARIFA + ILUMINAÇÃO + MULTA">Valor Sem MTZ</span>
        <span class="data-value highlight">R$ ${formatCurrency(calc.totalSemMTZ)}</span>
      </div>
      <div class="data-item">
        <span class="data-label">Valor da Conta de Energia</span>
        <span class="data-value highlight">R$ ${formatCurrency(calc.valorConta)}</span>
      </div>
    `;

    document.getElementById('discount-data').innerHTML = `
      <div class="data-item">
        <span class="data-label" title="(CONSUMO × TARIFA) × (1-DESC%) + ILUM + MULTA">Valor Cheio</span>
        <span class="data-value">R$ ${formatCurrency(calc.valorCheio)}</span>
      </div>
      <div class="data-item">
        <span class="data-label" title="Valor Cheio - Conta de Energia">Valor MTZ</span>
        <span class="data-value highlight-green">R$ ${formatCurrency(calc.valorMTZ)}</span>
      </div>
      <div class="data-item full-width">
        <span class="data-label" title="Valor Sem MTZ - Valor Cheio">Economia</span>
        <span class="data-value highlight-blue">R$ ${formatCurrency(calc.economia)}</span>
      </div>
    `;
  }

  function checkIfGD(bill) {
    // Check if billingData has GD-related items
    return bill.billingData?.some(item =>
      item.description?.includes('Custo de Disponibilidade') ||
      item.description?.includes('Energia compensada GD') ||
      item.description?.includes('Energia SCEE')
    );
  }

  function extractBillData(bill) {
    let custoDisponibilidade = 0;
    let consumoGD = 0;
    let tarifaEnergia = 0;

    bill.billingData?.forEach(item => {
      const desc = item.description || '';
      if (desc.includes('Custo de Disponibilidade') && !desc.includes('Ajuste')) {
        custoDisponibilidade = Math.abs(parseFloat(item.amount)) || 0;
      }
      if (desc.includes('Energia compensada GD')) {
        consumoGD = Math.abs(parseInt(item.quantity?.trim())) || 0;
      }
      if (desc.includes('Energia Elétrica') || desc.includes('Energia SCEE')) {
        tarifaEnergia = parseFloat(item.price) || 0;
        if (!consumoGD) consumoGD = Math.abs(parseInt(item.quantity?.trim())) || 0;
      }
    });

    if (!consumoGD && bill.consumption) consumoGD = bill.consumption;

    const fator = parseInt(tipoLigacaoSelect?.value || '100');
    const tarifaB1 = custoDisponibilidade / fator;

    const iluminacaoPublica = bill.comparativeBoard?.streetLighting || 0;
    const multas = bill.comparativeBoard?.fine || 0;

    const valorSemMTZ = (tarifaB1 * consumoGD) + iluminacaoPublica + multas;

    return {
      tarifaB1,
      tarifaEnergia,
      custoDisponibilidade,
      consumoGD,
      iluminacaoPublica,
      multas,
      valorSemMTZ,
      valorConta: bill.value
    };
  }

  /**
   * Calcula todos os valores da conta MTZ
   * 
   * FÓRMULAS:
   * - TOTAL (Valor Sem MTZ) = CONSUMO × TARIFA + ILUMINAÇÃO + MULTA
   * - VALOR CHEIO = (CONSUMO × TARIFA) × (1 - DESCONTO%) + ILUMINAÇÃO + MULTA
   *   (O desconto se aplica apenas à energia, não às cobranças CEMIG)
   * - VALOR MTZ = VALOR CHEIO - CONTA DE ENERGIA
   * - ECONOMIA = TOTAL - VALOR CHEIO
   */
  function calculateAll(extracted, valorConta, descontoPercent) {
    // Valores base extraídos da fatura
    const consumo = extracted.consumoGD;
    const tarifa = extracted.tarifaB1;
    const iluminacao = extracted.iluminacaoPublica;
    const multa = extracted.multas;

    // Cálculos
    const valorEnergia = tarifa * consumo;                          // CONSUMO × TARIFA
    const totalSemMTZ = valorEnergia + iluminacao + multa;          // TOTAL = CONSUMO × TARIFA + ILUM + MULTA
    const desconto = descontoPercent / 100;
    const valorEnergiaDesconto = valorEnergia * (1 - desconto);     // Desconto só na energia
    const valorCheio = valorEnergiaDesconto + iluminacao + multa;   // VALOR CHEIO
    const valorMTZ = valorCheio - valorConta;                       // VALOR MTZ = CHEIO - CEMIG
    const economia = totalSemMTZ - valorCheio;                      // ECONOMIA = TOTAL - CHEIO

    return {
      consumo,
      tarifa,
      iluminacao,
      multa,
      valorEnergia,
      totalSemMTZ,      // R$ 7.041,67 - Quanto pagaria sem MTZ
      valorCheio,       // R$ 4.995,23 - Total a pagar (MTZ + CEMIG)
      valorMTZ,         // R$ 3.935,00 - Valor a pagar à MTZ
      economia,         // R$ 2.046,44 - Economia com MTZ
      valorConta        // R$ 1.060,23 - Conta CEMIG
    };
  }

  function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return '0,00';
    // Arredonda para cima com 2 casas decimais
    const rounded = Math.ceil(value * 100) / 100;
    return rounded.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function setupGenerateDocument() {
    generateDocBtn?.addEventListener('click', async () => {
      if (!currentBillData) {
        alert('Nenhuma fatura capturada!');
        return;
      }

      const bill = currentBillData.data.billDetails.bills[0];
      const extracted = extractBillData(bill);
      const descontoPercent = parseFloat(descontoInput?.value || 30);

      // Usar função centralizada de cálculo
      const calc = calculateAll(extracted, bill.value, descontoPercent);

      // Get customer info from inputs
      const clienteNome = document.getElementById('cliente-nome')?.value || '';
      const clienteCnpj = document.getElementById('cliente-cnpj')?.value || '';
      const clienteEndereco = document.getElementById('cliente-endereco')?.value || '';
      const nInstalacao = document.getElementById('n-instalacao')?.value || '';

      // Format date
      const dueDate = new Date(bill.dueDate);
      const vencStr = dueDate.toLocaleDateString('pt-BR');

      try {
        // Fetch the template file
        const templateUrl = chrome.runtime.getURL('template.fodt');
        const response = await fetch(templateUrl);
        let template = await response.text();

        // Replace all variables using calculated values
        template = template.replace(/\{\{CLIENTE\}\}/g, clienteNome);
        template = template.replace(/\{\{CNPJPF\}\}/g, clienteCnpj);
        template = template.replace(/\{\{ENDERECO\}\}/g, clienteEndereco);
        template = template.replace(/\{\{DATA\}\}/g, bill.referenceMonth);
        template = template.replace(/\{\{NINSTALL\}\}/g, nInstalacao);
        template = template.replace(/\{\{VENC\}\}/g, vencStr);
        template = template.replace(/\{\{GDKWH\}\}/g, calc.consumo.toLocaleString('pt-BR'));
        template = template.replace(/\{\{GDPRECO\}\}/g, calc.tarifa);
        template = template.replace(/\{\{GDVAL\}\}/g, formatCurrency(calc.valorEnergia));
        template = template.replace(/\{\{EXTRAVAL\}\}/g, formatCurrency(calc.iluminacao + calc.multa));
        template = template.replace(/\{\{PERCENT\}\}/g, descontoPercent + '%');
        template = template.replace(/\{\{QTPAGARIA\}\}/g, 'R$ ' + formatCurrency(calc.totalSemMTZ));
        template = template.replace(/\{\{TOTAlMTZ\}\}/g, 'R$ ' + formatCurrency(calc.valorCheio));
        template = template.replace(/\{\{VALORPAGAR\}\}/g, 'R$ ' + formatCurrency(calc.valorCheio));
        template = template.replace(/\{\{VALORMTZ\}\}/g, 'R$ ' + formatCurrency(calc.valorMTZ));

        // Download the file
        const blob = new Blob([template], { type: 'application/vnd.oasis.opendocument.text' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Conta_MTZ_${bill.referenceMonth.replace('/', '-')}.fodt`;
        a.click();
        URL.revokeObjectURL(url);

        generateDocBtn.textContent = 'Documento gerado!';
        setTimeout(() => generateDocBtn.textContent = 'Gerar Documento', 2000);
      } catch (err) {
        console.error('Error generating document:', err);
        alert('Erro ao gerar documento: ' + err.message);
      }
    });
  }
});
