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

      loadCapturedData();
    }
  });

  // Listen for runtime messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {


    if (message.action === 'RELOAD_BILL_DATA') {

      loadCapturedData();
    }

    sendResponse({ status: 'ok' });
    return true;
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

  // Meses gerados checkboxes - save when changed
  const mesesCheckboxes = document.querySelectorAll('#meses-gerados input[type="checkbox"]');
  mesesCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      if (!selectedAccount) return;

      // Get all checked months
      const checkedMeses = [];
      mesesCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
          checkedMeses.push(parseInt(checkbox.dataset.mes));
        }
      });

      // Update selectedAccount
      selectedAccount.mesesGerados = checkedMeses;

      // Save to storage
      chrome.storage.local.get(['cemigAccounts'], (result) => {
        const accounts = result.cemigAccounts || [];
        const idx = accounts.findIndex(a => a.user === selectedAccount.user);
        if (idx !== -1) {
          accounts[idx].mesesGerados = checkedMeses;
          chrome.storage.local.set({ cemigAccounts: accounts }, () => {
            console.log('Meses gerados saved:', checkedMeses);
          });
        }
      });
    });
  });

  toggleDebugBtn?.addEventListener('click', () => {
    console.log('[DEBUG BUTTON] Clicked, debugView:', debugView);
    if (debugView) {
      const wasHidden = debugView.classList.contains('hidden');
      debugView.classList.toggle('hidden');
      console.log('[DEBUG BUTTON] Toggle complete, was hidden:', wasHidden, 'now hidden:', debugView.classList.contains('hidden'));
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
    chrome.storage.local.get(['cemigAccounts'], (result) => {
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

        // Show and populate meses gerados
        const mesesGeradosDiv = document.getElementById('meses-gerados');
        if (mesesGeradosDiv) {
          mesesGeradosDiv.classList.remove('hidden');
          const checkboxes = mesesGeradosDiv.querySelectorAll('input[type="checkbox"]');
          const mesesSalvos = acc.mesesGerados || [];
          checkboxes.forEach(cb => {
            const mes = parseInt(cb.dataset.mes);
            cb.checked = mesesSalvos.includes(mes);
          });
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
            chrome.tabs.sendMessage(tabs[0].id, { action: 'fill_creds', user: acc.user, pass: acc.pass }, (response) => {
              if (chrome.runtime.lastError) {
                console.log('Could not autofill (page may not be loaded):', chrome.runtime.lastError.message);
              }
            });
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
    console.log('[UPDATE CALCULATIONS] Called, currentBillData:', currentBillData);
    const bill = currentBillData.data.billDetails.bills[0];
    console.log('[UPDATE CALCULATIONS] Bill extracted:', bill);

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
    console.log('[UPDATE CALCULATIONS] isGD:', isGD);
    const extracted = extractBillData(bill);
    console.log('[UPDATE CALCULATIONS] extracted:', extracted);

    if (!isGD) {
      console.log('[UPDATE CALCULATIONS] NOT a GD account - returning early');
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
      ${extracted._debug.temEncargosExtras ? `
      <div class="data-item" style="background: #fff3cd; border-left: 3px solid #ffc107; padding: 8px; margin-top: 4px;">
        <span style="color: #856404; font-size: 12px;">⚠️ Favor verificar se os encargos extras (R$ ${formatCurrency(extracted._debug.diferencaResidual)}) da conta estão corretos</span>
      </div>
      ` : ''}
      ${extracted._debug.temErroCalculo ? `
      <div class="data-item" style="background: #f8d7da; border-left: 3px solid #dc3545; padding: 8px; margin-top: 4px;">
        <span style="color: #721c24; font-size: 12px;">❌ ERRO: Diferença residual negativa (R$ ${formatCurrency(extracted._debug.diferencaResidualReal)}). Verifique os dados.</span>
      </div>
      ` : ''}
    `;

    // Usar função centralizada de cálculo
    const descontoPercent = parseFloat(descontoInput?.value || 30);
    const calc = calculateAll(extracted, bill.value, descontoPercent);

    // Update debug view (passar bill também para mostrar dados brutos)
    console.log('[UPDATE CALCULATIONS] About to call updateDebugView with:', { extracted, calc, descontoPercent, bill });
    updateDebugView(extracted, calc, descontoPercent, bill);

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
    
    // Calcular multas incluindo correções não explícitas (IPCA/IGPM)
    const multasOficiais = bill.comparativeBoard?.fine || 0;
    
    // Calcular composition total com arredondamento intermediário para evitar erros de precisão
    let compositionTotal = 0;
    if (bill.composition) {
      for (const item of bill.composition) {
        compositionTotal += (item.value || 0);
      }
      // Arredondar para 2 casas decimais
      compositionTotal = Math.round(compositionTotal * 100) / 100;
    }
    
    // Diferença residual inclui correção IPCA/IGPM e outros ajustes não explícitos
    const diferencaResidualBruta = bill.value - (compositionTotal + iluminacaoPublica + multasOficiais);
    // Arredondar para 2 casas decimais para evitar erros de precisão de ponto flutuante
    const diferencaResidual = Math.round(diferencaResidualBruta * 100) / 100;
    
    // Multas totais = multas oficiais + diferença residual (se positiva)
    const multas = multasOficiais + Math.max(0, diferencaResidual);
    


    const valorSemMTZ = (tarifaB1 * consumoGD) + iluminacaoPublica + multas;

    // Extrair composition items para debug detalhado
    const compositionItems = {};
    if (bill.composition) {
      for (const item of bill.composition) {
        // Normalizar nomes removendo acentos
        const key = item.description
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '');
        compositionItems[key] = item.value || 0;
      }
    }

    return {
      tarifaB1,
      tarifaEnergia,
      custoDisponibilidade,
      consumoGD,
      iluminacaoPublica,
      multas,
      valorSemMTZ,
      valorConta: bill.value,
      naoCompensadoTotalmente,
      // Debug info e flags de aviso
      _debug: {
        multasOficiais,
        compositionTotal,
        compositionItems,
        diferencaResidual: Math.max(0, diferencaResidual),
        diferencaResidualReal: diferencaResidual, // Pode ser negativa
        temEncargosExtras: diferencaResidual > 0.01,
        temErroCalculo: diferencaResidual < -0.01
      }
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
    // Arredonda para 2 casas decimais (padrão: 0.5 arredonda para cima)
    const rounded = Math.round(value * 100) / 100;
    return rounded.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function updateDebugView(extracted, calc, descontoPercent, bill) {
    console.log('[DEBUG VIEW] Function called', { extracted, calc, descontoPercent, bill });
    const debugInfo = document.getElementById('debug-info');
    console.log('[DEBUG VIEW] Element found:', debugInfo);
    if (!debugInfo) {
      console.error('[DEBUG VIEW] Element debug-info not found!');
      return;
    }

    try {

    // Coletar dados brutos do billingData para mostrar origem
    const billingDataInfo = {};
    bill.billingData?.forEach(item => {
      billingDataInfo[item.description] = {
        price: item.price,
        quantity: item.quantity?.trim(),
        amount: item.amount
      };
    });

    // Fator de ligação usado
    const fator = parseInt(tipoLigacaoSelect?.value || '100');
    const tipoLigacaoLabel = fator === 100 ? 'Monofásico' : fator === 50 ? 'Bifásico' : 'Trifásico';

    const debugText = `
===============================================================
                    DEBUG - CALCULOS MTZ                       
===============================================================

ORIGEM DOS DADOS (API CEMIG):
===============================================================

1. DADOS DA FATURA (bill object):
---------------------------------------------------------------
   Fonte: bill.value
   Valor Total da Conta:     R$ ${formatCurrency(bill.value)}
   
   Fonte: bill.referenceMonth
   Mês de Referência:        ${bill.referenceMonth}
   
   Fonte: bill.consumption
   Consumo Total Medido:     ${bill.consumption} kWh

2. DADOS DO billingData (itens individuais):
---------------------------------------------------------------
${Object.entries(billingDataInfo).map(([desc, data]) => `   ${desc}:
   • Quantidade: ${data.quantity || 'N/A'}
   • Preço Unit: ${data.price || 'N/A'}
   • Valor: R$ ${formatCurrency(parseFloat(data.amount) || 0)}`).join('\n')}

3. DADOS DO comparativeBoard:
---------------------------------------------------------------
   Fonte: bill.comparativeBoard.streetLighting
   Iluminação Pública:       R$ ${formatCurrency(bill.comparativeBoard?.streetLighting || 0)}
   
   Fonte: bill.comparativeBoard.fine
   Multas Oficiais:          R$ ${formatCurrency(bill.comparativeBoard?.fine || 0)}
   
   Fonte: bill.comparativeBoard.icms
   ICMS:                     R$ ${formatCurrency(bill.comparativeBoard?.icms || 0)}

4. COMPOSIÇÃO DA FATURA (bill.composition):
---------------------------------------------------------------
${bill.composition?.map(item => `   ${item.description.padEnd(20)} R$ ${formatCurrency(item.value || 0).padStart(10)} (${item.percentValue})`).join('\n')}
   --------------------------------------------------------------
   SUBTOTAL:                 R$ ${formatCurrency(extracted._debug.compositionTotal)}

===============================================================
               PROCESSAMENTO E CALCULOS
===============================================================

PASSO 1: EXTRAÇÃO DA TARIFA B1
---------------------------------------------------------------
   Fonte: billingData["Custo de Disponibilidade"]
   Custo de Disponibilidade: R$ ${formatCurrency(extracted.custoDisponibilidade)}
   
   Parâmetro: Tipo de Ligação
   Tipo Selecionado:         ${tipoLigacaoLabel}
   Fator:                    ${fator}
   
   Cálculo: Tarifa B1 = Custo Disp. / Fator
   Tarifa B1 = ${formatCurrency(extracted.custoDisponibilidade)} / ${fator}
   Tarifa B1 = R$ ${formatCurrency(extracted.tarifaB1)}

PASSO 2: EXTRAÇÃO DO CONSUMO GD
---------------------------------------------------------------
   Fonte: billingData["Energia compensada GD II"]
   Consumo GD Compensado:    ${extracted.consumoGD} kWh

PASSO 3: EXTRAÇÃO DE ILUMINAÇÃO PÚBLICA
---------------------------------------------------------------
   Fonte: bill.comparativeBoard.streetLighting
   Iluminação Pública:       R$ ${formatCurrency(extracted.iluminacaoPublica)}

PASSO 4: CÁLCULO DAS MULTAS TOTAIS
---------------------------------------------------------------
   4.1) Multas Oficiais (API):
        Fonte: bill.comparativeBoard.fine
        Valor: R$ ${formatCurrency(extracted._debug.multasOficiais)}
   
   4.2) Cálculo de Demais Encargos:
        Soma da Composição: R$ ${formatCurrency(extracted._debug.compositionTotal)}
        
        Cálculo: Demais = Total - (Composition + Ilum + Multas)
                       = ${formatCurrency(bill.value)} - (${formatCurrency(extracted._debug.compositionTotal)} + ${formatCurrency(extracted.iluminacaoPublica)} + ${formatCurrency(extracted._debug.multasOficiais)})
                       = ${formatCurrency(bill.value)} - ${formatCurrency(extracted._debug.compositionTotal + extracted.iluminacaoPublica + extracted._debug.multasOficiais)}
                       = R$ ${formatCurrency(extracted._debug.diferencaResidual)}${extracted._debug.diferencaResidual > 0.01 ? ' ⚠️' : ''}
   
   4.3) Multas Totais:
        = Multas Oficiais + Demais Encargos
        = ${formatCurrency(extracted._debug.multasOficiais)} + ${formatCurrency(extracted._debug.diferencaResidual)}
        = R$ ${formatCurrency(extracted.multas)}

${extracted._debug.diferencaResidual > 0.01 ? `
   ⚠️  NOTA IMPORTANTE:
   Os "Demais encargos" (R$ ${formatCurrency(extracted._debug.diferencaResidual)}) representam valores não
   discriminados pela API CEMIG, incluindo:
   - Juros de mora (1% ao mês)
   - Multa de atraso (2%)
   - Correção monetária (IPCA/IGPM)
   - Outras taxas administrativas
` : ''}

===============================================================
          CÁLCULOS MTZ - PASSO A PASSO DETALHADO
===============================================================

PARÂMETROS DE CÁLCULO:
---------------------------------------------------------------
  • Desconto MTZ:           ${descontoPercent}%
  • Tipo de Ligação:        ${tipoLigacaoLabel} (fator ${fator})
  • Arredondamento:         Math.round (2 casas decimais)
  • Modo de cálculo:        Precisão mantida em todas etapas

---------------------------------------------------------------
PASSO 5: VALOR DA ENERGIA (sem desconto MTZ)
---------------------------------------------------------------
   Fórmula: Valor Energia = Tarifa B1 × Consumo GD
   
   Cálculo:
   = ${formatCurrency(calc.tarifa)} × ${calc.consumo.toLocaleString('pt-BR')} kWh
   = R$ ${formatCurrency(calc.valorEnergia)}
   
   Significado: Este é o valor que você pagaria APENAS pela 
                energia compensada pela GD, SEM o desconto MTZ.

---------------------------------------------------------------
PASSO 6: TOTAL SEM MTZ (quanto pagaria sem desconto)
---------------------------------------------------------------
   Fórmula: Total = Valor Energia + Iluminação + Multas
   
   Componentes:
   • Valor Energia:          R$ ${formatCurrency(calc.valorEnergia)}
   • Iluminação Pública:     R$ ${formatCurrency(calc.iluminacao)}
   • Multas/Cobranças:       R$ ${formatCurrency(calc.multa)}
   
   Cálculo:
   = ${formatCurrency(calc.valorEnergia)} + ${formatCurrency(calc.iluminacao)} + ${formatCurrency(calc.multa)}
   = R$ ${formatCurrency(calc.totalSemMTZ)}
   
   Significado: Este seria o valor TOTAL da conta se você NÃO
                tivesse o desconto da MTZ.

---------------------------------------------------------------
PASSO 7: APLICAÇÃO DO DESCONTO MTZ
---------------------------------------------------------------
   7.1) Cálculo do Desconto Percentual:
        Desconto Percentual = 1 - (${descontoPercent}% / 100)
                            = 1 - ${(descontoPercent/100).toFixed(2)}
                            = ${(1 - descontoPercent/100).toFixed(2)}
   
   7.2) Valor da Energia COM Desconto:
        = Valor Energia × Fator de Desconto
        = ${formatCurrency(calc.valorEnergia)} × ${(1 - descontoPercent/100).toFixed(2)}
        = R$ ${formatCurrency(calc.valorEnergia * (1 - descontoPercent/100))}
   
   ⚠️  IMPORTANTE: O desconto MTZ se aplica APENAS à energia!
                   Iluminação e Multas NÃO recebem desconto.

---------------------------------------------------------------
PASSO 8: VALOR CHEIO (total a pagar com MTZ)
---------------------------------------------------------------
   Fórmula: Valor Cheio = Energia Descontada + Ilum + Multas
   
   Componentes:
   • Energia c/ Desconto:    R$ ${formatCurrency(calc.valorEnergia * (1 - descontoPercent/100))}
   • Iluminação (sem desc):  R$ ${formatCurrency(calc.iluminacao)}
   • Multas (sem desconto):  R$ ${formatCurrency(calc.multa)}
   
   Cálculo:
   = ${formatCurrency(calc.valorEnergia * (1 - descontoPercent/100))} + ${formatCurrency(calc.iluminacao)} + ${formatCurrency(calc.multa)}
   = R$ ${formatCurrency(calc.valorCheio)}
   
   Significado: Este é o valor TOTAL que você vai pagar 
                (CEMIG + MTZ) COM o desconto.

---------------------------------------------------------------
PASSO 9: DIVISÃO DO PAGAMENTO (CEMIG vs MTZ)
---------------------------------------------------------------
   9.1) Conta CEMIG (já paga):
        Fonte: bill.value
        Valor: R$ ${formatCurrency(calc.valorConta)}
   
   9.2) Valor MTZ (a pagar para MTZ):
        Fórmula: Valor MTZ = Valor Cheio - Conta CEMIG
        
        Cálculo:
        = ${formatCurrency(calc.valorCheio)} - ${formatCurrency(calc.valorConta)}
        = R$ ${formatCurrency(calc.valorMTZ)}
   
   ${calc.valorMTZ < 0 ? `   ⚠️  ATENÇÃO: Valor MTZ negativo!
        Isso significa que a conta CEMIG (R$ ${formatCurrency(calc.valorConta)}) 
        é MAIOR que o valor cheio com desconto (R$ ${formatCurrency(calc.valorCheio)}).
        
        Possíveis causas:
        • Conta com multas/juros muito altos
        • Consumo não totalmente compensado pela GD
        • Outros encargos não previstos
        • Custo de disponibilidade anormal` : `   ✅ Valor MTZ positivo - cliente paga à MTZ e economiza!`}

---------------------------------------------------------------
PASSO 10: ECONOMIA GERADA
---------------------------------------------------------------
   Fórmula: Economia = Total Sem MTZ - Valor Cheio
   
   Cálculo:
   = ${formatCurrency(calc.totalSemMTZ)} - ${formatCurrency(calc.valorCheio)}
   = R$ ${formatCurrency(calc.economia)}
   
   Percentual de Economia:
   = (${formatCurrency(calc.economia)} / ${formatCurrency(calc.totalSemMTZ)}) × 100
   = ${((calc.economia / calc.totalSemMTZ) * 100).toFixed(2)}%
   
   Significado: Este é o valor que o cliente ECONOMIZOU ao 
                contratar a MTZ ao invés de pagar o valor cheio.

===============================================================
                    RESUMO FINAL
===============================================================

COMPARAÇÃO DE CENÁRIOS:
---------------------------------------------------------------
  Cenário 1 - SEM MTZ (hipotético):
  • Valor Total:            R$ ${formatCurrency(calc.totalSemMTZ)}
  • Pagaria à CEMIG:        R$ ${formatCurrency(calc.totalSemMTZ)}
  
  Cenário 2 - COM MTZ (real):
  • Valor Total:            R$ ${formatCurrency(calc.valorCheio)}
  • Paga à CEMIG:           R$ ${formatCurrency(calc.valorConta)}
  • Paga à MTZ:             R$ ${formatCurrency(calc.valorMTZ)}
  • Economia:               R$ ${formatCurrency(calc.economia)} (${((calc.economia / calc.totalSemMTZ) * 100).toFixed(2)}%)

FLUXO DE PAGAMENTO:
---------------------------------------------------------------
  1️⃣  Cliente paga à CEMIG:  R$ ${formatCurrency(calc.valorConta)}
  2️⃣  Cliente paga à MTZ:    R$ ${formatCurrency(calc.valorMTZ)}
  ───────────────────────────────────────
  💰 Total pago pelo cliente: R$ ${formatCurrency(calc.valorCheio)}
  
  ✅ Economia em relação ao valor sem desconto:
     R$ ${formatCurrency(calc.totalSemMTZ)} - R$ ${formatCurrency(calc.valorCheio)} = R$ ${formatCurrency(calc.economia)}

BREAKDOWN DOS VALORES:
---------------------------------------------------------------
  Energia (COM desconto ${descontoPercent}%):
  • Base (sem desconto):    R$ ${formatCurrency(calc.valorEnergia)}
  • Desconto aplicado:      R$ ${formatCurrency(calc.valorEnergia * (descontoPercent/100))}
  • Valor final:            R$ ${formatCurrency(calc.valorEnergia * (1 - descontoPercent/100))}
  
  Valores SEM desconto:
  • Iluminação Pública:     R$ ${formatCurrency(calc.iluminacao)}
  • Multas/Cobranças:       R$ ${formatCurrency(calc.multa)}
    ├─ Multas oficiais:     R$ ${formatCurrency(extracted._debug.multasOficiais)}
    └─ Demais encargos:     R$ ${formatCurrency(extracted._debug.diferencaResidual)}

===============================================================
            TEMPLATE DOCUMENT (.fodt) - EXTRAVAL
===============================================================

O que é EXTRAVAL?
---------------------------------------------------------------
  EXTRAVAL é uma variável usada no documento gerado (.fodt)
  que representa os valores que NÃO recebem desconto MTZ.
  
  Estes valores são somados à energia descontada para calcular
  o valor total que o cliente deve pagar.

Cálculo do EXTRAVAL:
---------------------------------------------------------------
  Fórmula: EXTRAVAL = Iluminação Pública + Multas Totais
  
  Componentes:
  • Iluminação Pública:     R$ ${formatCurrency(calc.iluminacao)}
  • Multas Totais:          R$ ${formatCurrency(calc.multa)}
    ├─ Multas oficiais:     R$ ${formatCurrency(extracted._debug.multasOficiais)}
    └─ Demais encargos:     R$ ${formatCurrency(extracted._debug.diferencaResidual)}
  
  Cálculo:
  = ${formatCurrency(calc.iluminacao)} + ${formatCurrency(calc.multa)}
  = R$ ${formatCurrency(calc.iluminacao + calc.multa)}
  
  ⚠️  Estes valores NÃO recebem o desconto de ${descontoPercent}% da MTZ!

===============================================================
                 VERIFICAÇÕES E VALIDAÇÕES
===============================================================

VERIFICAÇÃO MATEMÁTICA:
---------------------------------------------------------------
  Regra: Conta CEMIG + Valor MTZ = Valor Cheio
  
  Teste:
  ${formatCurrency(calc.valorConta)} + (${formatCurrency(calc.valorMTZ)}) = ${formatCurrency(calc.valorConta + calc.valorMTZ)}
  
  Valor Cheio calculado: ${formatCurrency(calc.valorCheio)}
  
  ${Math.abs((calc.valorConta + calc.valorMTZ) - calc.valorCheio) < 0.01 ? '✅ VERIFICAÇÃO OK - Valores conferem!' : '❌ ERRO - Valores não conferem!'}

VERIFICAÇÃO DE COMPONENTES:
---------------------------------------------------------------
  Total dos Componentes:
  • Composition:            R$ ${formatCurrency(extracted._debug.compositionTotal)}
  • Iluminação:             R$ ${formatCurrency(extracted.iluminacaoPublica)}
  • Multas:                 R$ ${formatCurrency(extracted.multas)}
  ───────────────────────────────────────
  Soma:                     R$ ${formatCurrency(extracted._debug.compositionTotal + extracted.iluminacaoPublica + extracted.multas)}
  
  Valor da Conta (API):     R$ ${formatCurrency(bill.value)}
  Diferença:                R$ ${formatCurrency(bill.value - (extracted._debug.compositionTotal + extracted.iluminacaoPublica + extracted.multas))}
  
  ${Math.abs(bill.value - (extracted._debug.compositionTotal + extracted.iluminacaoPublica + extracted.multas)) < 0.01 ? '✅ Valores conferem perfeitamente!' : `⚠️  Diferença detectada - incluída em "Demais encargos"`}

${extracted._debug.temEncargosExtras ? `
===============================================================
       ⚠️  ATENÇÃO - ENCARGOS EXTRAS DETECTADOS
===============================================================

Valor detectado: R$ ${formatCurrency(extracted._debug.diferencaResidual)}

O que são "Demais encargos"?
---------------------------------------------------------------
  São valores cobrados na fatura mas NÃO discriminados pela
  API da CEMIG. Incluem:
  
  ✓ Multa por atraso (2% sobre o valor da conta)
  ✓ Juros de mora (1% ao mês ou proporcional)
  ✓ Correção monetária (IPCA/IGPM)
  ✓ Taxas administrativas
  ✓ Outros encargos não especificados

Como são calculados?
---------------------------------------------------------------
  Fórmula: Demais = Total - (Composition + Ilum + Multas)
  
  Detalhamento:
  1. Total da conta (API):  R$ ${formatCurrency(bill.value)}
  2. Composition total:     R$ ${formatCurrency(extracted._debug.compositionTotal)}
  3. Iluminação pública:    R$ ${formatCurrency(extracted.iluminacaoPublica)}
  4. Multas oficiais:       R$ ${formatCurrency(extracted._debug.multasOficiais)}
  
  Diferença residual:
  = ${formatCurrency(bill.value)} - (${formatCurrency(extracted._debug.compositionTotal)} + ${formatCurrency(extracted.iluminacaoPublica)} + ${formatCurrency(extracted._debug.multasOficiais)})
  = R$ ${formatCurrency(extracted._debug.diferencaResidual)} ⚠️

⚠️  AÇÃO REQUERIDA:
  Por favor, verifique a fatura física/PDF para confirmar se
  este valor corresponde a encargos de atraso ou outras taxas.

` : ''}${extracted._debug.temErroCalculo ? `
===============================================================
           ❌ ERRO - DIFERENÇA RESIDUAL NEGATIVA
===============================================================

Valor detectado: R$ ${formatCurrency(extracted._debug.diferencaResidualReal)}

O que significa?
---------------------------------------------------------------
  Uma diferença residual negativa indica que a SOMA dos
  componentes conhecidos é MAIOR que o valor total da conta.
  
  Isso é anormal e pode indicar:

Possíveis causas:
---------------------------------------------------------------
  ❌ Mudanças na estrutura da API da CEMIG
  ❌ Novos campos adicionados que não estamos capturando
  ❌ Descontos não mapeados (ex: tarifa social, isençõestributárias)
  ❌ Erros de arredondamento acumulados
  ❌ Créditos aplicados não discriminados

⚠️  AÇÃO REQUERIDA:
  1. Verifique a fatura física/PDF
  2. Compare os valores manualmente
  3. Revise o JSON completo da API
  4. Reporte este caso se persistir

Breakdown da diferença:
---------------------------------------------------------------
  Composition:              R$ ${formatCurrency(extracted._debug.compositionTotal)}
  + Iluminação:             R$ ${formatCurrency(extracted.iluminacaoPublica)}
  + Multas:                 R$ ${formatCurrency(extracted._debug.multasOficiais)}
  ───────────────────────────────────────
  = Soma dos componentes:   R$ ${formatCurrency(extracted._debug.compositionTotal + extracted.iluminacaoPublica + extracted._debug.multasOficiais)}
  
  Valor da conta (API):     R$ ${formatCurrency(bill.value)}
  
  Diferença (NEGATIVA):     R$ ${formatCurrency(extracted._debug.diferencaResidualReal)} ❌

` : ''}
===============================================================
                    FIM DO DEBUG
===============================================================
`;

    console.log('[DEBUG VIEW] Debug text generated, length:', debugText.length);
    debugInfo.textContent = debugText;
    console.log('[DEBUG VIEW] Text assigned to element');
    } catch (error) {
      console.error('[DEBUG VIEW ERROR]', error);
      debugInfo.textContent = `ERRO AO GERAR DEBUG:\n${error.message}\n\nStack:\n${error.stack}`;
    }
  }

  function setupGenerateDocument() {
    generateDocBtn?.addEventListener('click', async () => {
      if (!currentBillData) {
        alert('Nenhuma fatura capturada!');
        return;
      }

      if (!selectedAccount) {
        alert('Selecione uma conta antes de gerar o documento!');
        return;
      }

      const bill = currentBillData.data.billDetails.bills[0];
      const extracted = extractBillData(bill);
      const descontoPercent = parseFloat(descontoInput?.value || 30);
      const calc = calculateAll(extracted, bill.value, descontoPercent);

      // Get customer info from selected account
      const clienteNome = selectedAccount.nome || '';
      const clienteCnpj = selectedAccount.cnpj || '';
      const clienteEndereco = selectedAccount.endereco || '';
      const nInstalacao = selectedAccount.instalacao || '';

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
        const dueDate = new Date(bill.dueDate);
        vencStr = dueDate.toLocaleDateString('pt-BR');
      }

      try {
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
        // EXTRAVAL = Iluminação + Multas (inclui multas oficiais + demais encargos)
        const extraval = calc.iluminacao + calc.multa;
        template = template.replace(/\{\{EXTRAVAL\}\}/g, formatCurrency(extraval));
        template = template.replace(/\{\{PERCENT\}\}/g, descontoPercent + '%');
        template = template.replace(/\{\{QTPAGARIA\}\}/g, 'R$ ' + formatCurrency(calc.totalSemMTZ));
        template = template.replace(/\{\{TOTALMTZ\}\}/g, 'R$ ' + formatCurrency(calc.valorCheio));
        template = template.replace(/\{\{VALORPAGAR\}\}/g, 'R$ ' + formatCurrency(calc.valorCheio));
        template = template.replace(/\{\{VALORMTZ\}\}/g, 'R$ ' + formatCurrency(calc.valorMTZ));
        template = template.replace(/\{\{ECONOMIZOU\}\}/g, 'R$ ' + formatCurrency(calc.economia));

        // Download the file
        const blob = new Blob([template], { type: 'application/vnd.oasis.opendocument.text' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Sanitize client name for filename (remove invalid characters)
        const sanitizedName = clienteNome.replace(/[/\\?%*:|"<>]/g, '-').trim();
        const fileName = `${sanitizedName}_${nInstalacao}_${bill.referenceMonth.replace('/', '-')}.fodt`;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);

        generateDocBtn.textContent = 'Documento gerado!';
        setTimeout(() => generateDocBtn.textContent = 'Gerar Documento', 2000);
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
