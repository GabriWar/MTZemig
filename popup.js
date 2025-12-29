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
  const toggleJsonBtn = document.getElementById('toggle-json-btn');
  const toggleDebugBtn = document.getElementById('toggle-debug-btn');
  const jsonView = document.getElementById('json-view');
  const debugView = document.getElementById('debug-view');
  const descontoInput = document.getElementById('desconto');
  const tipoLigacaoSelect = document.getElementById('tipo-ligacao');
  const generateDocBtn = document.getElementById('generate-doc-btn');
  const formTitle = document.getElementById('form-title');
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importForm = document.getElementById('import-form');
  const importConfirmBtn = document.getElementById('import-confirm-btn');
  const importCancelBtn = document.getElementById('import-cancel-btn');
  const jsonImportTextarea = document.getElementById('json-import');
  const searchAccountsInput = document.getElementById('search-accounts');

  let currentBillData = null;
  let editingUser = null; // Track which account is being edited
  let selectedAccount = null; // Track which account is selected for document generation
  let allAccounts = []; // Store all accounts for filtering

  loadAccounts();
  loadCapturedData();
  setupGenerateDocument();
  setupImportExport();

  // Listen for storage changes to auto-update when new bill data is captured
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.lastCapturedBill) {
      console.log('[STORAGE] New bill data detected, reloading...');
      loadCapturedData();
    }
  });

  // Search accounts
  searchAccountsInput?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allAccounts.filter(acc => {
      const searchText = `${acc.nome || ''} ${acc.user || ''} ${acc.cnpj || ''} ${acc.instalacao || ''}`.toLowerCase();
      return searchText.includes(query);
    });
    renderAccounts(filtered);
  });

  descontoInput?.addEventListener('input', () => {
    if (currentBillData) updateCalculations();
  });

  tipoLigacaoSelect?.addEventListener('change', () => {
    if (currentBillData) updateCalculations();
  });

  toggleDebugBtn?.addEventListener('click', () => {
    if (debugView) {
      debugView.classList.toggle('hidden');
    }
  });

  toggleJsonBtn?.addEventListener('click', () => {
    if (jsonView) {
      jsonView.classList.toggle('hidden');
    }
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
      desconto: document.getElementById('acc-desconto')?.value || '30',
      diaVencimento: document.getElementById('acc-vencimento')?.value || ''
    };

    saveAccount(accountData);
  });

  function loadAccounts() {
    console.log('[LOAD] Loading accounts from storage...');
    chrome.storage.local.get(['cemigAccounts'], (result) => {
      console.log('[LOAD] Storage result:', result);
      console.log('[LOAD] Accounts:', result.cemigAccounts);
      allAccounts = result.cemigAccounts || [];
      renderAccounts(allAccounts);
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
        if (searchAccountsInput) searchAccountsInput.value = ''; // Clear search
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
        chrome.storage.local.set({ cemigAccounts: newAccounts }, () => {
          if (searchAccountsInput) searchAccountsInput.value = ''; // Clear search
          loadAccounts();
        });
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
    document.getElementById('acc-vencimento').value = account.diaVencimento || '';
    
    // Show form
    addForm.classList.remove('hidden');
    showAddBtn.classList.add('hidden');
  }

  function renderAccounts(accounts) {
    console.log('[RENDER] Rendering accounts, count:', accounts.length);
    console.log('[RENDER] Accounts data:', accounts);
    console.log('[RENDER] Account list element:', accountList);
    
    accountList.innerHTML = accounts.length === 0
      ? '<p style="text-align:center; color:#888;">Nenhuma conta salva.</p>'
      : '';
    accounts.forEach(acc => {
      console.log('[RENDER] Rendering account:', acc);
      const item = document.createElement('div');
      item.className = 'account-item';
      item.style.cursor = 'pointer';
      item.title = 'Clique para preencher dados e autofill';
      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn') || e.target.closest('.edit-btn')) return;

        // Store selected account
        selectedAccount = acc;

        // Update UI to show selected account
        const selectedAccountInfo = document.getElementById('selected-account-info');
        if (selectedAccountInfo) {
          selectedAccountInfo.innerHTML = `
            <span class="data-label">Conta Selecionada</span>
            <span class="data-value" style="color: #00d9a5;">${acc.nome || acc.user}</span>
          `;
        }

        // Enable generate document button
        if (generateDocBtn) generateDocBtn.disabled = false;

        // Fill tipo ligação and desconto
        if (tipoLigacaoSelect) tipoLigacaoSelect.value = acc.tipoLigacao || '100';
        if (descontoInput) descontoInput.value = acc.desconto || '30';

        // Trigger recalculation
        if (currentBillData) updateCalculations();

        // Send autofill to page (only if on Cemig domain)
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && tabs[0].url && 
              (tabs[0].url.includes('atende.cemig.com.br') || 
               tabs[0].url.includes('atendimento.cemig.com.br'))) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'fill_creds', user: acc.user, pass: acc.pass });
          }
        });
      });

      // Show nome if available, otherwise just user
      const displayName = acc.nome || acc.user;
      const subInfo = acc.nome ? `${acc.user} / ${acc.pass}` : acc.pass;

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
    document.getElementById('acc-vencimento').value = '';
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
    const tarifaLabel = extracted.naoCompensadoTotalmente 
      ? 'Tarifa B1 (não compensado totalmente)' 
      : 'Tarifa B1';
    
    document.getElementById('extracted-data').innerHTML = `
      <div class="data-item">
        <span class="data-label" title="Custo de Disponibilidade / Fator">${tarifaLabel}</span>
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

    // Update debug view
    updateDebugView(extracted, calc, descontoPercent);

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
    let tarifaEnergiaEletrica = 0;
    let naoCompensadoTotalmente = false;

    bill.billingData?.forEach(item => {
      const desc = item.description || '';
      if (desc.includes('Custo de Disponibilidade') && !desc.includes('Ajuste')) {
        custoDisponibilidade = Math.abs(parseFloat(item.amount)) || 0;
      }
      if (desc.includes('Energia compensada GD')) {
        consumoGD = Math.abs(parseInt(item.quantity?.trim())) || 0;
      }
      if (desc.includes('Energia Elétrica')) {
        tarifaEnergiaEletrica = parseFloat(item.price) || 0;
        naoCompensadoTotalmente = true;
      }
      if (desc.includes('Energia Elétrica') || desc.includes('Energia SCEE')) {
        tarifaEnergia = parseFloat(item.price) || 0;
        if (!consumoGD) consumoGD = Math.abs(parseInt(item.quantity?.trim())) || 0;
      }
    });

    if (!consumoGD && bill.consumption) consumoGD = bill.consumption;

    const fator = parseInt(tipoLigacaoSelect?.value || '100');
    let tarifaB1 = custoDisponibilidade / fator;
    
    // Se não tem custo de disponibilidade, usa tarifa de energia elétrica
    if (tarifaB1 === 0 && tarifaEnergiaEletrica > 0) {
      tarifaB1 = tarifaEnergiaEletrica;
    }

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
      valorConta: bill.value,
      naoCompensadoTotalmente
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

  function updateDebugView(extracted, calc, descontoPercent) {
    const debugInfo = document.getElementById('debug-info');
    if (!debugInfo) return;

    const debugText = `
===============================================================
                    DEBUG - CALCULOS MTZ                       
===============================================================

DADOS EXTRAIDOS DA FATURA:
---------------------------------------------------------------
  - Tarifa B1:              R$ ${formatCurrency(extracted.tarifaB1)}
  - Consumo GD:             ${extracted.consumoGD.toLocaleString('pt-BR')} kWh
  - Iluminacao Publica:     R$ ${formatCurrency(extracted.iluminacaoPublica)}
  - Multas/Cobrancas:       R$ ${formatCurrency(extracted.multas)}
  - Valor Conta CEMIG:      R$ ${formatCurrency(extracted.valorConta)}

PARAMETROS:
---------------------------------------------------------------
  - Desconto MTZ:           ${descontoPercent}%

FORMULAS E CALCULOS:
---------------------------------------------------------------

[1] VALOR ENERGIA (sem desconto):
    = Tarifa B1 x Consumo GD
    = ${formatCurrency(calc.tarifa)} x ${calc.consumo.toLocaleString('pt-BR')}
    = R$ ${formatCurrency(calc.valorEnergia)}

[2] TOTAL SEM MTZ (quanto pagaria sem desconto):
    = Valor Energia + Iluminacao + Multas
    = ${formatCurrency(calc.valorEnergia)} + ${formatCurrency(calc.iluminacao)} + ${formatCurrency(calc.multa)}
    = R$ ${formatCurrency(calc.totalSemMTZ)}

[3] VALOR CHEIO (com desconto MTZ):
    = (Valor Energia x (1 - ${descontoPercent}%)) + Iluminacao + Multas
    = (${formatCurrency(calc.valorEnergia)} x ${(1 - descontoPercent/100).toFixed(2)}) + ${formatCurrency(calc.iluminacao)} + ${formatCurrency(calc.multa)}
    = ${formatCurrency(calc.valorEnergia * (1 - descontoPercent/100))} + ${formatCurrency(calc.iluminacao)} + ${formatCurrency(calc.multa)}
    = R$ ${formatCurrency(calc.valorCheio)}

[4] VALOR MTZ (a pagar para MTZ):
    = Valor Cheio - Conta CEMIG
    = ${formatCurrency(calc.valorCheio)} - ${formatCurrency(calc.valorConta)}
    = R$ ${formatCurrency(calc.valorMTZ)}

[5] ECONOMIA (quanto economizou):
    = Total Sem MTZ - Valor Cheio
    = ${formatCurrency(calc.totalSemMTZ)} - ${formatCurrency(calc.valorCheio)}
    = R$ ${formatCurrency(calc.economia)}

RESUMO FINAL:
---------------------------------------------------------------
  > Pagaria sem MTZ:       R$ ${formatCurrency(calc.totalSemMTZ)}
  > Total a pagar:         R$ ${formatCurrency(calc.valorCheio)}
  > Conta CEMIG:           R$ ${formatCurrency(calc.valorConta)}
  > Valor MTZ:             R$ ${formatCurrency(calc.valorMTZ)}
  > Economia:              R$ ${formatCurrency(calc.economia)}

VERIFICACAO:
   Conta CEMIG + Valor MTZ = Valor Cheio
   ${formatCurrency(calc.valorConta)} + ${formatCurrency(calc.valorMTZ)} = ${formatCurrency(calc.valorConta + calc.valorMTZ)}
   ${formatCurrency(calc.valorCheio)} = ${formatCurrency(calc.valorCheio)} OK
`;

    debugInfo.textContent = debugText;
  }

  function setupGenerateDocument() {
    console.log('[SETUP] setupGenerateDocument called');
    console.log('[SETUP] generateDocBtn:', generateDocBtn);
    
    generateDocBtn?.addEventListener('click', async () => {
      console.log('[CLICK] Generate document button clicked!');
      console.log('[CHECK] currentBillData:', currentBillData);
      console.log('[CHECK] selectedAccount:', selectedAccount);
      
      if (!currentBillData) {
        console.log('[ERROR] No bill data');
        alert('Nenhuma fatura capturada!');
        return;
      }

      if (!selectedAccount) {
        console.log('[ERROR] No account selected');
        alert('Selecione uma conta antes de gerar o documento!');
        return;
      }

      console.log('[START] Starting document generation...');
      const bill = currentBillData.data.billDetails.bills[0];
      console.log('[BILL] Bill data:', bill);
      
      const extracted = extractBillData(bill);
      console.log('[EXTRACTED] Extracted data:', extracted);
      
      const descontoPercent = parseFloat(descontoInput?.value || 30);
      console.log('[DESCONTO] Discount percent:', descontoPercent);

      // Usar função centralizada de cálculo
      const calc = calculateAll(extracted, bill.value, descontoPercent);
      console.log('[CALC] Calculated values:', calc);

      // Get customer info from selected account
      const clienteNome = selectedAccount.nome || '';
      const clienteCnpj = selectedAccount.cnpj || '';
      const clienteEndereco = selectedAccount.endereco || '';
      const nInstalacao = selectedAccount.instalacao || '';
      console.log('[CUSTOMER] Nome:', clienteNome, 'CNPJ:', clienteCnpj);

      // Format date - using configured due day + current month/year
      let vencStr = '';
      if (selectedAccount.diaVencimento) {
        const hoje = new Date();
        const dia = parseInt(selectedAccount.diaVencimento);
        const mes = hoje.getMonth(); // 0-11
        const ano = hoje.getFullYear();
        const dataVenc = new Date(ano, mes, dia);
        vencStr = dataVenc.toLocaleDateString('pt-BR');
      } else {
        // Fallback to bill due date if no day configured
        const dueDate = new Date(bill.dueDate);
        vencStr = dueDate.toLocaleDateString('pt-BR');
      }
      console.log('[DATE] Due date:', vencStr);

      try {
        console.log('[TEMPLATE] Fetching template...');
        // Fetch the template file
        const templateUrl = chrome.runtime.getURL('template.fodt');
        console.log('[TEMPLATE] URL:', templateUrl);
        
        const response = await fetch(templateUrl);
        console.log('[TEMPLATE] Response status:', response.status);
        
        let template = await response.text();
        console.log('[TEMPLATE] Template loaded, length:', template.length);

        console.log('[REPLACE] Starting template replacements...');
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
        template = template.replace(/\{\{ECONOMIZOU\}\}/g, 'R$ ' + formatCurrency(calc.economia));
        console.log('[REPLACE] Replacements completed');

        // Download the file
        console.log('[DOWNLOAD] Creating blob and download link...');
        const blob = new Blob([template], { type: 'application/vnd.oasis.opendocument.text' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = `Conta_MTZ_${bill.referenceMonth.replace('/', '-')}.fodt`;
        a.download = fileName;
        console.log('[DOWNLOAD] File name:', fileName);
        a.click();
        URL.revokeObjectURL(url);
        console.log('[DOWNLOAD] Download triggered!');

        generateDocBtn.textContent = 'Documento gerado!';
        setTimeout(() => generateDocBtn.textContent = 'Gerar Documento', 2000);
        console.log('[SUCCESS] Document generation completed successfully!');
      } catch (err) {
        console.error('[ERROR] Error generating document:', err);
        console.error('[ERROR] Stack trace:', err.stack);
        alert('Erro ao gerar documento: ' + err.message);
      }
    });
  }

  function setupImportExport() {
    // Export button
    exportBtn?.addEventListener('click', () => {
      chrome.storage.local.get(['cemigAccounts'], (result) => {
        const accounts = result.cemigAccounts || [];
        if (accounts.length === 0) {
          alert('Nenhuma conta para exportar!');
          return;
        }

        // Create JSON string
        const jsonString = JSON.stringify(accounts, null, 2);

        // Download as file
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cemig_accounts_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        exportBtn.textContent = 'Exportado!';
        setTimeout(() => exportBtn.textContent = 'Exportar Contas', 2000);
      });
    });

    // Import button - show form
    importBtn?.addEventListener('click', () => {
      importForm.classList.remove('hidden');
      showAddBtn.classList.add('hidden');
      addForm.classList.add('hidden');
      jsonImportTextarea.value = '';
    });

    // Import cancel
    importCancelBtn?.addEventListener('click', () => {
      importForm.classList.add('hidden');
      showAddBtn.classList.remove('hidden');
      jsonImportTextarea.value = '';
    });

    // Import confirm
    importConfirmBtn?.addEventListener('click', () => {
      const jsonText = jsonImportTextarea.value.trim();
      if (!jsonText) {
        alert('Por favor, cole o JSON das contas.');
        return;
      }

      try {
        const importedAccounts = JSON.parse(jsonText);
        
        // Validate it's an array
        if (!Array.isArray(importedAccounts)) {
          alert('JSON inválido! Deve ser um array de contas.');
          return;
        }

        // Validate each account has required fields
        for (let acc of importedAccounts) {
          if (!acc.user || !acc.pass) {
            alert('JSON inválido! Cada conta deve ter "user" e "pass".');
            return;
          }
        }

        // Merge with existing accounts
        chrome.storage.local.get(['cemigAccounts'], (result) => {
          const existingAccounts = result.cemigAccounts || [];
          const merged = [...existingAccounts];

          // Add or update accounts
          importedAccounts.forEach(importedAcc => {
            const idx = merged.findIndex(a => a.user === importedAcc.user);
            if (idx >= 0) {
              merged[idx] = importedAcc; // Update existing
            } else {
              merged.push(importedAcc); // Add new
            }
          });

          chrome.storage.local.set({ cemigAccounts: merged }, () => {
            if (searchAccountsInput) searchAccountsInput.value = ''; // Clear search
            loadAccounts();
            importForm.classList.add('hidden');
            showAddBtn.classList.remove('hidden');
            jsonImportTextarea.value = '';
            alert(`${importedAccounts.length} conta(s) importada(s) com sucesso!`);
          });
        });
      } catch (err) {
        alert('Erro ao processar JSON: ' + err.message);
      }
    });
  }
});
