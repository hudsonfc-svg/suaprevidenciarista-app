/* === CONFIGURE AQUI - substitua os placeholders === */
const CONFIG = {
  AIRTABLE_API_KEY: "PASTE_AIRTABLE_KEY_HERE",
  AIRTABLE_BASE_ID: "PASTE_BASE_ID_HERE",
  AIRTABLE_TABLE_CLIENTES: "Clientes",
  AIRTABLE_TABLE_PROCESSOS: "Processos",
  MAKE_WEBHOOK_URL: "PASTE_MAKE_WEBHOOK_HERE",
  ADMIN_PASSWORD: "senhaadmin123" /* troque para algo seguro */
};
/* ================================================== */

const headersAirtable = {
  "Authorization": "Bearer " + CONFIG.AIRTABLE_API_KEY,
  "Content-Type": "application/json"
};

function $(id){return document.getElementById(id)}

/* Screens */
const screens = { home: $('home'), track: $('track'), new: $('new'), admin: $('admin') };
function show(screen){
  Object.values(screens).forEach(s=>s.classList.add('hidden'));
  screens[screen].classList.remove('hidden');
}

/* Navegação */
$('btnTrack').addEventListener('click',()=>show('track'));
$('btnNew').addEventListener('click',()=>show('new'));
$('btnBackFromNew').addEventListener('click',()=>show('home'));
$('btnBackFromTrack').addEventListener('click',()=>show('home'));
$('btnBackFromAdmin').addEventListener('click',()=>show('home'));

/* Condicionais do form */
$('sexo').addEventListener('change',e=>{
  if(e.target.value==='F') document.getElementById('gestacaoBlock').classList.remove('hidden');
  else document.getElementById('gestacaoBlock').classList.add('hidden');
});
document.querySelector('[name="ctps"]').addEventListener('change',e=>{
  if(e.target.value==='sim') document.getElementById('anosCtpsBlock').classList.remove('hidden');
  else document.getElementById('anosCtpsBlock').classList.add('hidden');
});
document.querySelector('[name="doenca"]').addEventListener('change',e=>{
  if(e.target.value==='sim') document.getElementById('laudoBlock').classList.remove('hidden');
  else document.getElementById('laudoBlock').classList.add('hidden');
});
document.querySelector('[name="recebeu_inss"]').addEventListener('change',e=>{
  if(e.target.value==='sim') document.getElementById('recebeuBlock').classList.remove('hidden');
  else document.getElementById('recebeuBlock').classList.add('hidden');
});

/* Submit do formulário - cria registro no Airtable e chama Make para IA */
$('formNew').addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const payload = Object.fromEntries(fd.entries());
  payload.createdAt = new Date().toISOString();

  // salvar no Airtable (tabela Clientes)
  const record = { fields: {
    Nome: payload.nome || '',
    Idade: payload.idade || '',
    Sexo: payload.sexo || '',
    Gestante: payload.gestante || '',
    BolsaFamilia: payload.bolsa || '',
    Renda: payload.renda || '',
    Trabalho: payload.trabalha || '',
    CTPS: payload.ctps || '',
    AnosCTPS: payload.anos_ctps || '',
    Doenca: payload.doenca || '',
    Laudo: payload.laudo || '',
    DescDoenca: payload.desc_doenca || '',
    RecebeuINSS: payload.recebeu_inss || '',
    QualBeneficio: payload.qual_beneficio || '',
    Telefone: payload.telefone || '',
    Endereco: payload.endereco || '',
    LGPD: payload.lgpd || '',
    CreatedAt: payload.createdAt
  }};

  try {
    const res = await fetch(`https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(CONFIG.AIRTABLE_TABLE_CLIENTES)}`, {
      method: 'POST',
      headers: headersAirtable,
      body: JSON.stringify(record)
    });
    const data = await res.json();
    // agora chamamos o Make webhook para receber a resposta da IA
    const makeBody = {
      cliente: payload,
      airtableRecordId: data.id || null
    };
    const makeRes = await fetch(CONFIG.MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(makeBody)
    });
    const makeJson = await makeRes.json();
    const aiText = makeJson.result || "No momento não foi possível gerar análise automática. Fale com a Dra. Daniele.";

    // mostrar resultado
    const aiDiv = $('aiResult');
    aiDiv.classList.remove('hidden');
    aiDiv.innerHTML = `<h3>Orientação (resumo automático)</h3><div>${aiText.replace(/\n/g,'<br>')}</div>
      <hr>
      <div><strong>Contato:</strong> Rua Pedro Mata, 67 — Em frente ao INSS, Chapadinha-MA</div>
      <div><strong>WhatsApp:</strong> 98 99147-9384 • <strong>Instagram:</strong> @suaprevidenciarista</div>`;
    // opcional: limpar form
    ev.target.reset();
  } catch(err){
    console.error(err);
    alert('Erro ao salvar. Verifique as chaves e a conexão.');
  }
});

/* Acompanhar processo - busca na tabela Processos (por Numero ou CPF) */
$('btnSearch').addEventListener('click', async ()=>{
  const q = $('trackInput').value.trim();
  if(!q) return alert('Digite o número do processo ou CPF');
  const filter = `OR({Processo}="${q}",{CPF}="${q}")`;
  try {
    const res = await fetch(`https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(CONFIG.AIRTABLE_TABLE_PROCESSOS)}?filterByFormula=${encodeURIComponent(filter)}&sort[0][field]=Movimentacao&sort[0][direction]=desc`, {
      headers: headersAirtable
    });
    const j = await res.json();
    const out = $('trackResult');
    if(j.records && j.records.length>0){
      const r = j.records[0].fields;
      out.innerHTML = `<strong>Processo:</strong> ${r.Processo || '-'}<br>
        <strong>Última movimentação:</strong> ${r.Movimentacao || '-'}<br>
        <strong>Data:</strong> ${r.DataMov || '-'}<br>
        <strong>Decisão/Observação:</strong> ${r.Observacao || '-'}<br>
        <div style="margin-top:8px"><em>Se precisar de mais detalhes, fale com a Dra. Daniele:</em><br>98 99147-9384</div>`;
    } else {
      out.innerHTML = `<em>Nenhum processo encontrado com esses dados. Procure a Dra. Daniele.</em>`;
    }
  } catch(err){
    console.error(err);
    alert('Erro ao buscar. Verifique as chaves.');
  }
});

/* Admin login */
$('btnAdminLogin').addEventListener('click', async ()=>{
  const pass = $('adminPass').value;
  if(pass === CONFIG.ADMIN_PASSWORD){
    $('adminPanel').classList.remove('hidden');
    // carregar atendimentos recentes
    loadAdminList();
  } else alert('Senha incorreta');
});

async function loadAdminList(){
  try{
    const res = await fetch(`https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(CONFIG.AIRTABLE_TABLE_CLIENTES)}?pageSize=20&sort[0][field]=CreatedAt&sort[0][direction]=desc`, {
      headers: headersAirtable
    });
    const j = await res.json();
    const wrap = $('adminList');
    wrap.innerHTML = '';
    if(j.records){
      j.records.forEach(rec=>{
        const f = rec.fields;
        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `<strong>${f.Nome || '-'}</strong><div>Telefone: ${f.Telefone || '-'}</div><div>Renda: ${f.Renda || '-'}</div><div>Id: ${rec.id}</div>`;
        wrap.appendChild(el);
      });
    }
  }catch(err){console.error(err);alert('Erro ao carregar atendimentos');}
}

/* Salvar movimentação (admin) */
$('btnSaveMov').addEventListener('click', async ()=>{
  const processo = $('proc_num').value.trim();
  const dataMov = $('mov_date').value;
  const text = $('mov_text').value.trim();
  if(!processo || !dataMov || !text) return alert('Preencha todos os campos');
  // Criar/atualizar registro na tabela Processos
  try {
    // tenta encontrar processo
    const filter = `{Processo}="${processo}"`;
    const findRes = await fetch(`https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(CONFIG.AIRTABLE_TABLE_PROCESSOS)}?filterByFormula=${encodeURIComponent(filter)}`, { headers: headersAirtable});
    const fj = await findRes.json();
    if(fj.records && fj.records.length>0){
      // atualizar o primeiro
      const recId = fj.records[0].id;
      const update = { fields: { Movimentacao: text, DataMov: dataMov, Observacao: text } };
      await fetch(`https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(CONFIG.AIRTABLE_TABLE_PROCESSOS)}/${recId}`, { method: 'PATCH', headers: headersAirtable, body: JSON.stringify(update)});
      alert('Movimentação atualizada!');
    } else {
      // criar novo
      const create = { fields: { Processo: processo, Movimentacao: text, DataMov: dataMov, Observacao: text } };
      await fetch(`https://api.airtable.com/v0/${CONFIG.AIRTABLE_BASE_ID}/${encodeURIComponent(CONFIG.AIRTABLE_TABLE_PROCESSOS)}`, { method: 'POST', headers: headersAirtable, body: JSON.stringify(create)});
      alert('Processo criado com movimentação!');
    }
    loadAdminList();
  } catch(err){console.error(err);alert('Erro ao salvar movimentação');}
}
);
