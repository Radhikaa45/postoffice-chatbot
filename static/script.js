document.addEventListener('DOMContentLoaded', function () {
  // --- Base element references ---
  const chatbotButton = document.getElementById('chatbotButton');
  const chatbotWindow = document.getElementById('chatbotWindow');
  const closeChatbot = document.getElementById('closeChatbot');
  const userInput = document.getElementById('userInput');
  const sendMessage = document.getElementById('sendMessage');
  const chatbotMessages = document.getElementById('chatbotMessages');
  const resetButton = document.getElementById('resetChatbot');

  // --- Feedback / Quit Modal ---
  const quitModal = document.getElementById('quitModal');
  const confirmQuit = document.getElementById('confirmQuit');
  const cancelQuit = document.getElementById('cancelQuit');
  const closeModalBtn = quitModal ? quitModal.querySelector('.close-modal-btn') : null;
  const feedbackEmojis = quitModal ? quitModal.querySelectorAll('.emoji-btn') : [];
  const stars = document.querySelectorAll('#starRating .star');
  const submitFeedback = document.getElementById('submitFeedback');

  // --- Image Upload ---
  const imageUpload = document.getElementById('imageUpload');
  const uploadButtonLabel = document.getElementById('uploadButtonLabel');

  // --- Quick Access Buttons ---
  const findPostOfficeBtn = document.getElementById('findPostOfficeBtn');
  const trackItemBtn = document.getElementById('trackItemBtn');

  // --- Star Feedback Logic ---
  let selectedRating = 0;
  if (stars && stars.length) {
    stars.forEach(star => {
      star.addEventListener('click', function () {
        selectedRating = parseInt(this.getAttribute('data-value'));
        stars.forEach((s, i) => i < selectedRating ? s.classList.add('selected') : s.classList.remove('selected'));
        if (submitFeedback) submitFeedback.disabled = !selectedRating;
      });
    });
  }

  if (submitFeedback) {
    submitFeedback.addEventListener('click', function () {
      if (!selectedRating) return;
      if (quitModal) quitModal.style.display = 'none';
      chatbotWindow.classList.remove('active');
      stars.forEach(s => s.classList.remove('selected'));
      selectedRating = 0;
      submitFeedback.disabled = true;
    });
  }

  // --- Feedback Emoji Buttons ---
  if (feedbackEmojis) {
    feedbackEmojis.forEach(button => {
      button.addEventListener('click', function () {
        console.log(`Thanks for your feedback: ${button.textContent}`);
        quitModal.style.display = 'none';
        chatbotWindow.classList.remove('active');
      });
    });
  }

  // --- Open/Close Chatbot ---
  if (chatbotButton) {
    chatbotButton.addEventListener('click', function () {
      chatbotWindow.classList.toggle('active');
      if (chatbotWindow.classList.contains('active')) {
        // Send 'hi' to initiate the conversation/main menu
        setTimeout(() => sendUserMessage('hi'), 500); 
        
        // CRITICAL: Set scroll position to TOP (0) when opening
        chatbotMessages.scrollTop = 0; 
      }
    });
  }

  if (closeChatbot) {
    closeChatbot.addEventListener('click', function () {
      quitModal.style.display = 'block';
    });
  }

  if (confirmQuit) {
    confirmQuit.addEventListener('click', async function () {
      chatbotWindow.classList.remove('active');
      chatbotMessages.innerHTML = '';
      quitModal.style.display = 'none';
      await fetchBotResponse('reset');
      
      // CRITICAL: Set scroll position to TOP (0) after reset
      chatbotMessages.scrollTop = 0;
      chatbotWindow.classList.add('active'); // Re-open chat window after reset
    });
  }

  if (cancelQuit) cancelQuit.addEventListener('click', () => quitModal.style.display = 'none');
  if (closeModalBtn) closeModalBtn.addEventListener('click', () => quitModal.style.display = 'none');

  // --- Utility functions ---
  function addMessageToChat(message, sender) {
    const div = document.createElement('div');
    div.classList.add(`${sender}-message`);
    div.innerHTML = `<p>${message}</p>`;
    chatbotMessages.appendChild(div);
    chatbotMessages.scrollTo({ top: 50, behavior: 'smooth' });
    // REMOVED SCROLL: chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }

  function createOptionButtons(options) {
    const existing = chatbotMessages.querySelector('.bot-options');
    if (existing) existing.remove();
    const wrap = document.createElement('div');
    wrap.classList.add('bot-options');
    options.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'option-button';
      b.textContent = opt.text;
      b.onclick = () => {
        addMessageToChat(opt.text, 'user');
        fetchBotResponse(opt.value);
      };
      wrap.appendChild(b);
    });
    chatbotMessages.appendChild(wrap);
    chatbotMessages.scrollTo({ top: 50, behavior: 'smooth' });
    // REMOVED SCROLL: chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }

  function createLoadingMessage(text) {
    const d = document.createElement('div');
    d.classList.add('loading-message');
    d.innerHTML = `<p>${text}</p>`;
    chatbotMessages.appendChild(d);
    // REMOVED SCROLL: chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    return d;
  }

  function removeLoadingMessage(el) {
    if (el) el.remove();
  }

  // --- Phone Normalizer ---
  function normalizePhone(raw) {
    if (!raw) return '';
    const digits = String(raw).replace(/\D+/g, '');
    if (!digits) return '';
    if (digits.length === 10) return '+91' + digits;
    if (digits.length >= 11 && digits.length <= 13) return '+' + digits;
    return digits;
  }

  // --- Address Formatter ---
  function formatAddress(po) {
    const parts = [po.Address, po.Block, po.Division, po.District, po.State]
      .map(x => (x || '').toString().trim())
      .filter(Boolean);
    const dedup = [];
    parts.forEach(p => {
      const last = dedup[dedup.length - 1];
      if (!last || last.toLowerCase() !== p.toLowerCase()) dedup.push(p);
    });
    const line = dedup.join(', ');
    return po.Pincode ? `${line}, ${po.Pincode}` : line;
  }

  // --- Post Office Card Renderer ---
  function renderPostOfficeCards(postOffices, { showAll = false } = {}) {
    if (!Array.isArray(postOffices) || !postOffices.length) return;
    const existing = chatbotMessages.querySelector('.bot-options');
    if (existing) existing.remove();
    const max = showAll ? postOffices.length : Math.min(5, postOffices.length);
    for (let i = 0; i < max; i++) {
      const po = postOffices[i];
      const name = `${po.Name || 'Post Office'} ${po.BranchType ? '(' + po.BranchType + ')' : ''}`.trim();
      const addr = formatAddress(po);
      let rawPhone = (po.Phone || po.Contact || po.Telephone || '').toString().trim();
      const junk = ['-', '—', 'n/a', 'na', 'nil', 'null', 'none'];
      if (junk.includes(rawPhone.toLowerCase())) rawPhone = '';
      const phone = normalizePhone(rawPhone);
      const mapsQ = encodeURIComponent([po.Name, po.District, po.State, po.Pincode].filter(Boolean).join(' '));
      const mapsHref = `https://www.google.com/maps/search/?api=1&query=${mapsQ}`;

      const card = document.createElement('div');
      card.className = 'po-card';
      card.innerHTML = `
        <div class="po-badge"><div class="po-title" title="${name}">${name}</div></div>
        <div class="po-content">${addr || 'Address not available'}</div>
        <div class="po-actions">
          <a class="po-btn" href="${mapsHref}" target="_blank" title="Open in Maps">
            <i class="fas fa-location-dot po-icon"></i></a>
          ${phone
            ? `<a class="po-btn" href="tel:${phone}" title="Call ${phone}">
                <i class="fas fa-phone po-icon"></i></a>`
            : `<button class="po-btn po-call-disabled" disabled title="Phone not available">
                <i class="fas fa-phone po-icon"></i></button>`}
          <button class="po-btn po-share" data-name="${encodeURIComponent(name)}"
            data-addr="${encodeURIComponent(addr)}" data-phone="${encodeURIComponent(phone)}" title="Share">
            <i class="fas fa-share-nodes po-icon"></i>
          </button>
        </div>`;
      chatbotMessages.appendChild(card);
    }

    if (postOffices.length > 5 && !showAll) {
      const more = document.createElement('div');
      more.className = 'bot-options';
      const btn = document.createElement('button');
      btn.className = 'option-button';
      btn.textContent = `Show All (${postOffices.length})`;
      btn.onclick = () => {
        chatbotMessages.querySelectorAll('.po-card').forEach(c => c.remove());
        more.remove();
        renderPostOfficeCards(postOffices, { showAll: true });
      };
      more.appendChild(btn);
      chatbotMessages.appendChild(more);
    }

    // REMOVED SCROLL: chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    wireShareButtons();
    wireCallFallback();
  }

  function wireShareButtons() {
    const shareBtns = chatbotMessages.querySelectorAll('.po-card .po-share');
    shareBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = decodeURIComponent(btn.dataset.name || '');
        const addr = decodeURIComponent(btn.dataset.addr || '');
        const phone = decodeURIComponent(btn.dataset.phone || '');
        const text = `${name}\n${addr}${phone ? `\nPhone: ${phone}` : ''}`;
        if (navigator.share) {
          try { await navigator.share({ title: name, text }); } catch { }
        } else {
          await navigator.clipboard.writeText(text);
          alert('Post Office details copied!');
        }
      });
    });
  }

  function wireCallFallback() {
    const callLinks = chatbotMessages.querySelectorAll('.po-card a[href^="tel:"]');
    callLinks.forEach(link => {
      link.addEventListener('click', async () => {
        const num = link.getAttribute('href').replace('tel:', '');
        try { await navigator.clipboard.writeText(num); } catch { }
      });
    });
  }

  // --- Location Flow ---
  async function getLocationAndSendToServer() {
    const load = createLoadingMessage("Please wait, getting your location...");
    if (!navigator.geolocation) {
      removeLoadingMessage(load);
      addMessageToChat("I'm sorry, your browser does not support geolocation.", 'bot');
      return;
    }
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      removeLoadingMessage(load);
      await fetchBotResponseWithLocation(coords.latitude, coords.longitude);
    }, (err) => {
      removeLoadingMessage(load);
      addMessageToChat("I'm sorry, I couldn't get your location. Please try again or find an office by Pincode.", 'bot');
    });
  }

  async function fetchBotResponseWithLocation(latitude, longitude) {
    const load = createLoadingMessage("Searching for nearby post offices...");
    try {
      const res = await fetch('/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: "find_office_by_location", latitude, longitude })
      });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      removeLoadingMessage(load);
      addMessageToChat(data.response, 'bot');
      if (Array.isArray(data.full_data) && data.full_data.length) {
        renderPostOfficeCards(data.full_data);
      } else if (Array.isArray(data.options) && data.options.length) {
        createOptionButtons(data.options);
      }
    } catch {
      removeLoadingMessage(load);
      addMessageToChat("Sorry, I'm having trouble connecting right now. Please try again later.", 'bot');
    }
  }

  // --- File Upload Logic ---
  if (imageUpload) {
    imageUpload.addEventListener('change', async function (event) {
      const file = event.target.files[0];
      if (file) {
        addMessageToChat(`[Image Selected: ${file.name}] - Uploading...`, 'user');
        await uploadFile(file);
        imageUpload.value = '';
      }
    });
  }

  async function uploadFile(file) {
    const load = createLoadingMessage("Sending image to server...");
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch('/upload-image', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      removeLoadingMessage(load);
      addMessageToChat(data.response, 'bot');
      if (data.options) createOptionButtons(data.options);
    } catch {
      removeLoadingMessage(load);
      addMessageToChat("Sorry, there was an issue uploading your image. Please try again.", 'bot');
    }
  }

  // --- Chatbot Core Fetch ---
  async function fetchBotResponse(message) {
    if (message === 'find_office_by_location') return getLocationAndSendToServer();

    if (message === 'reset') {
      chatbotMessages.innerHTML = '';
      await fetch('/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'reset' })
      });
      sendUserMessage('hi');
      return;
    }

    try {
      const res = await fetch('/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();

      // Strict upload control
      if (imageUpload && uploadButtonLabel) {
        if (data.show_upload === true) {
          imageUpload.disabled = false;
          uploadButtonLabel.classList.remove('disabled-upload');
          uploadButtonLabel.title = "Upload Image or Take Photo for Complaint";
        } else {
          imageUpload.disabled = true;
          uploadButtonLabel.classList.add('disabled-upload');
          uploadButtonLabel.title = "Select a Complaint type first";
        }
      }

      setTimeout(() => {
        addMessageToChat(data.response, 'bot');
        if (Array.isArray(data.full_data) && data.full_data.length) {
          renderPostOfficeCards(data.full_data);
        } else if (Array.isArray(data.options) && data.options.length) {
          createOptionButtons(data.options);
        }
      }, 500);
    } catch {
      setTimeout(() => addMessageToChat("Sorry, I'm having trouble connecting right now. Please try again later.", 'bot'), 500);
    }
  }

  // --- User Message Sender ---
  function sendUserMessage(message = null) {
    const msg = message || userInput.value.trim();
    if (!msg) return;
    if (!message) addMessageToChat(msg, 'user');
    userInput.value = '';
    fetchBotResponse(msg);
  }

  // --- Event Listeners ---
  if (sendMessage) sendMessage.addEventListener('click', () => sendUserMessage());
  if (userInput) userInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendUserMessage(); });
  if (resetButton) resetButton.addEventListener('click', () => fetchBotResponse('reset'));
  if (findPostOfficeBtn) findPostOfficeBtn.addEventListener('click', e => { e.preventDefault(); chatbotWindow.classList.add('active'); fetchBotResponse('find_office_by_location'); });
  if (trackItemBtn) trackItemBtn.addEventListener('click', e => { e.preventDefault(); chatbotWindow.classList.add('active'); fetchBotResponse('track_trace'); });

  // REMOVED SCROLL: chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
});