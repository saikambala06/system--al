if (!SKVK.getToken()) {
  window.location.href = 'index.html';
}

// ---------- tabs ----------
document.querySelectorAll('.tab-btn').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  SKVK.clearToken();
  window.location.href = 'index.html';
});

// ---------- education / experience repeatable rows ----------

function addEducationRow(data = {}) {
  const row = document.createElement('div');
  row.className = 'repeat-row';
  row.innerHTML = `
    <input placeholder="School" class="edu-school" value="${escapeAttr(data.school)}">
    <input placeholder="Degree" class="edu-degree" value="${escapeAttr(data.degree)}">
    <input placeholder="Field of study" class="edu-field" value="${escapeAttr(data.fieldOfStudy)}">
    <input placeholder="Start year" class="edu-start" value="${escapeAttr(data.startDate)}">
    <input placeholder="End year" class="edu-end" value="${escapeAttr(data.endDate)}">
    <input placeholder="GPA" class="edu-gpa" value="${escapeAttr(data.gpa)}">
    <button type="button" class="remove-row" aria-label="Remove">Remove</button>
  `;
  row.querySelector('.remove-row').addEventListener('click', () => row.remove());
  document.getElementById('educationList').appendChild(row);
}

function addExperienceRow(data = {}) {
  const row = document.createElement('div');
  row.className = 'repeat-row';
  row.innerHTML = `
    <input placeholder="Company" class="exp-company" value="${escapeAttr(data.company)}">
    <input placeholder="Title" class="exp-title" value="${escapeAttr(data.title)}">
    <input placeholder="Location" class="exp-location" value="${escapeAttr(data.location)}">
    <input placeholder="Start (e.g. Jan 2022)" class="exp-start" value="${escapeAttr(data.startDate)}">
    <input placeholder="End (blank if current)" class="exp-end" value="${escapeAttr(data.endDate)}">
    <label class="checkbox-label"><input type="checkbox" class="exp-current" ${data.current ? 'checked' : ''}> Current role</label>
    <textarea placeholder="What did you do here?" class="exp-desc">${escapeHtml(data.description)}</textarea>
    <button type="button" class="remove-row" aria-label="Remove">Remove</button>
  `;
  row.querySelector('.remove-row').addEventListener('click', () => row.remove());
  document.getElementById('experienceList').appendChild(row);
}

document.getElementById('addEducation').addEventListener('click', () => addEducationRow());
document.getElementById('addExperience').addEventListener('click', () => addExperienceRow());

function collectEducation() {
  return Array.from(document.querySelectorAll('#educationList .repeat-row')).map((row) => ({
    school: row.querySelector('.edu-school').value,
    degree: row.querySelector('.edu-degree').value,
    fieldOfStudy: row.querySelector('.edu-field').value,
    startDate: row.querySelector('.edu-start').value,
    endDate: row.querySelector('.edu-end').value,
    gpa: row.querySelector('.edu-gpa').value
  }));
}

function collectExperience() {
  return Array.from(document.querySelectorAll('#experienceList .repeat-row')).map((row) => ({
    company: row.querySelector('.exp-company').value,
    title: row.querySelector('.exp-title').value,
    location: row.querySelector('.exp-location').value,
    startDate: row.querySelector('.exp-start').value,
    endDate: row.querySelector('.exp-end').value,
    current: row.querySelector('.exp-current').checked,
    description: row.querySelector('.exp-desc').value
  }));
}

function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ---------- profile ----------

async function loadProfile() {
  const p = await SKVK.apiRequest('/profile');
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  set('firstName', p.personal?.firstName);
  set('lastName', p.personal?.lastName);
  set('email', p.personal?.email);
  set('phone', p.personal?.phone);
  set('address', p.personal?.address);
  set('city', p.personal?.city);
  set('state', p.personal?.state);
  set('zip', p.personal?.zip);
  set('country', p.personal?.country);

  set('linkedin', p.links?.linkedin);
  set('github', p.links?.github);
  set('portfolio', p.links?.portfolio);
  set('website', p.links?.website);

  set('authorizedToWork', p.workAuth?.authorizedToWork);
  set('requireSponsorship', p.workAuth?.requireSponsorship);
  set('visaStatus', p.workAuth?.visaStatus);

  set('gender', p.eeo?.gender);
  set('race', p.eeo?.race);
  set('veteranStatus', p.eeo?.veteranStatus);
  set('disabilityStatus', p.eeo?.disabilityStatus);

  set('desiredSalary', p.preferences?.desiredSalary);
  set('willingToRelocate', p.preferences?.willingToRelocate);
  set('remotePreference', p.preferences?.remotePreference);
  set('noticePeriod', p.preferences?.noticePeriod);
  set('earliestStartDate', p.preferences?.earliestStartDate);

  set('summary', p.summary);
  set('skills', (p.skills || []).join(', '));

  document.getElementById('educationList').innerHTML = '';
  document.getElementById('experienceList').innerHTML = '';
  (p.education || []).forEach(addEducationRow);
  (p.experience || []).forEach(addExperienceRow);
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const get = (id) => document.getElementById(id).value;
  const statusEl = document.getElementById('profileStatus');
  statusEl.textContent = 'Saving...';

  const payload = {
    personal: {
      firstName: get('firstName'), lastName: get('lastName'), email: get('email'),
      phone: get('phone'), address: get('address'), city: get('city'),
      state: get('state'), zip: get('zip'), country: get('country')
    },
    links: {
      linkedin: get('linkedin'), github: get('github'), portfolio: get('portfolio'), website: get('website')
    },
    workAuth: {
      authorizedToWork: get('authorizedToWork'), requireSponsorship: get('requireSponsorship'), visaStatus: get('visaStatus')
    },
    eeo: {
      gender: get('gender'), race: get('race'), veteranStatus: get('veteranStatus'), disabilityStatus: get('disabilityStatus')
    },
    preferences: {
      desiredSalary: get('desiredSalary'), willingToRelocate: get('willingToRelocate'),
      remotePreference: get('remotePreference'), noticePeriod: get('noticePeriod'), earliestStartDate: get('earliestStartDate')
    },
    summary: get('summary'),
    skills: get('skills').split(',').map((s) => s.trim()).filter(Boolean),
    education: collectEducation(),
    experience: collectExperience()
  };

  try {
    await SKVK.apiRequest('/profile', { method: 'PUT', body: payload });
    statusEl.textContent = 'Saved';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  }
});

// ---------- Q&A bank ----------

async function loadQABank() {
  const items = await SKVK.apiRequest('/qa');
  const tbody = document.getElementById('qaTableBody');
  const emptyState = document.getElementById('qaEmptyState');
  tbody.innerHTML = '';

  emptyState.classList.toggle('hidden', items.length > 0);

  items.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="qa-question">${escapeHtml(item.question)}</td>
      <td>${escapeHtml(item.answer)}</td>
      <td><span class="stamp stamp-${item.source}">${item.source === 'ai' ? 'AI DRAFT' : 'SAVED'}</span></td>
      <td>${item.useCount || 0}</td>
      <td class="qa-actions">
        <button class="link-btn edit-qa" data-id="${item._id}">Edit</button>
        <button class="link-btn delete-qa" data-id="${item._id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.delete-qa').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this Q&A pair?')) return;
      await SKVK.apiRequest(`/qa/${btn.dataset.id}`, { method: 'DELETE' });
      loadQABank();
    });
  });

  tbody.querySelectorAll('.edit-qa').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = items.find((i) => i._id === btn.dataset.id);
      document.getElementById('qaQuestion').value = item.question;
      document.getElementById('qaAnswer').value = item.answer;
      document.getElementById('qaForm').dataset.editId = item._id;
      document.getElementById('qaFormTitle').textContent = 'Edit Q&A';
      document.getElementById('qaQuestion').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

document.getElementById('qaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const question = document.getElementById('qaQuestion').value.trim();
  const answer = document.getElementById('qaAnswer').value.trim();
  const editId = e.target.dataset.editId;
  if (!question || !answer) return;

  try {
    if (editId) {
      await SKVK.apiRequest(`/qa/${editId}`, { method: 'PUT', body: { question, answer } });
      delete e.target.dataset.editId;
      document.getElementById('qaFormTitle').textContent = 'Add Q&A';
    } else {
      await SKVK.apiRequest('/qa', { method: 'POST', body: { question, answer, fieldType: 'text' } });
    }
    document.getElementById('qaQuestion').value = '';
    document.getElementById('qaAnswer').value = '';
    loadQABank();
  } catch (err) {
    alert(err.message);
  }
});

// ---------- init ----------

(async () => {
  try {
    const me = await SKVK.apiRequest('/auth/me');
    document.getElementById('userGreeting').textContent = `Hi, ${me.name}`;
  } catch (err) {
    SKVK.clearToken();
    window.location.href = 'index.html';
    return;
  }

  loadProfile().catch((err) => console.error('Profile load failed:', err));
  loadQABank().catch((err) => console.error('Q&A bank load failed:', err));
})();
