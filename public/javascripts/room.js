// Room functionality - Real-time collaborative coding
(function() {
  // Get room data from server-side variables
  const roomId = window.roomData ? window.roomData.roomId : window.location.pathname.split('/').pop();
  const userName = window.roomData ? window.roomData.userName : document.querySelector('.room-header strong')?.textContent || 'User';
  const socket = io();

  // Initialize CodeMirror
  const editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
    lineNumbers: true,
    theme: 'dracula',
    mode: 'javascript',
    indentUnit: 2,
    autoCloseTags: true,
    autoCloseBrackets: true,
    lineWrapping: true
  });

  let ignoreCodeChange = false;

  // Code change events
  editor.on('change', () => {
    if (!ignoreCodeChange) {
      socket.emit('code-change', { roomId, code: editor.getValue() });
    }
  });

  // Language selector
  const langSelect = document.getElementById('languageSelect');
  langSelect.addEventListener('change', () => {
    const lang = langSelect.value;
    socket.emit('language-change', { roomId, language: lang });
  });

  function setEditorLanguage(lang) {
    let mode = 'javascript';
    if (lang === 'python') mode = 'python';
    else if (lang === 'cpp') mode = 'text/x-c++src';
    else if (lang === 'java') mode = 'text/x-java';
    else if (lang === 'text') mode = null;
    editor.setOption('mode', mode);
  }

  // Socket events
  socket.emit('join-room', { roomId, userName });

  socket.on('init-code', (code) => {
    ignoreCodeChange = true;
    editor.setValue(code || '');
    ignoreCodeChange = false;
  });

  socket.on('init-language', (lang) => {
    langSelect.value = lang;
    setEditorLanguage(lang);
  });

  socket.on('code-change', (code) => {
    if (code !== editor.getValue()) {
      ignoreCodeChange = true;
      editor.setValue(code);
      ignoreCodeChange = false;
    }
  });

  socket.on('language-change', (lang) => {
    langSelect.value = lang;
    setEditorLanguage(lang);
  });

  // Timer functionality
  const startTime = Date.now();
  const timerDisplay = document.getElementById('timerDisplay');

  function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    timerDisplay.textContent = `⏱️ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  updateTimer();
  setInterval(updateTimer, 1000);

  // Leave room functionality
  document.getElementById('leaveBtn').addEventListener('click', (e) => {
    e.preventDefault();
    socket.emit('leave-room', { roomId, userName });
    window.location.href = '/join';
  });

  // Run code functionality
  document.getElementById('runCode').addEventListener('click', () => {
    document.getElementById('preview').srcdoc = editor.getValue();
    document.getElementById('aiOutput').style.display = 'none';
  });

  // AI Analysis functionality
  const aiOutputDiv = document.getElementById('aiOutput');
  document.getElementById('aiAnalyze').addEventListener('click', () => {
    aiOutputDiv.style.display = 'block';
    aiOutputDiv.textContent = '⏳ Analyzing code...';
    socket.emit('ai-analyze', { roomId, code: editor.getValue() });
  });

  socket.on('ai-response', ({ analysis }) => {
    aiOutputDiv.style.display = 'block';
    aiOutputDiv.textContent = analysis;
  });

  socket.on('ai-error', ({ error }) => {
    aiOutputDiv.style.display = 'block';
    aiOutputDiv.textContent = '❌ Error: ' + error;
  });

  // Chat functionality
  const chatMessages = document.getElementById('chatMessages');

  function escapeHTML(s) {
    return String(s).replace(/[&<>"]/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    })[m]);
  }

  function addChatMessage(username, text) {
    const d = document.createElement('div');
    d.className = 'msg';
    d.innerHTML = '<strong>' + escapeHTML(username) + '</strong> ' + escapeHTML(text);
    chatMessages.appendChild(d);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  document.getElementById('sendChat').addEventListener('click', () => {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (message) {
      socket.emit('chat', { roomId, userName, message });
      input.value = '';
    }
  });

  document.getElementById('chatInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      document.getElementById('sendChat').click();
    }
  });

  socket.on('chat', ({ userName, message }) => {
    addChatMessage(userName, message);
  });

  // File sharing functionality
  const fileListDiv = document.getElementById('fileList');

  document.getElementById('uploadTrigger').addEventListener('click', () => {
    document.getElementById('fileUpload').click();
  });

  document.getElementById('fileUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      socket.emit('file-share', {
        roomId,
        userName,
        fileName: file.name,
        fileData: ev.target.result
      });
    };
    reader.readAsDataURL(file);
    this.value = '';
  });

  socket.on('file-share', ({ userName, fileName, fileData }) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `<span style="color:#9ac7ff;">${escapeHTML(userName)}</span> shared <a href="${fileData}" download="${fileName}">📎 ${escapeHTML(fileName)}</a>`;
    fileListDiv.appendChild(item);
    fileListDiv.scrollTop = fileListDiv.scrollHeight;
  });

  // WebRTC functionality
  let localStream;
  let micEnabled = true;
  let camEnabled = true;
  const video = document.getElementById('selfVideo');
  const cameraErrorDiv = document.getElementById('cameraError');

  function startMedia() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localStream = stream;
        video.srcObject = stream;
        video.onloadedmetadata = () => video.play();
        cameraErrorDiv.style.display = 'none';
      })
      .catch(err => {
        console.warn(err);
        cameraErrorDiv.style.display = 'block';
        cameraErrorDiv.textContent = '⚠️ Camera/mic access denied.';
      });
  }

  startMedia();

  // Camera/Mic controls
  document.getElementById('micToggle').addEventListener('click', () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      micEnabled = !micEnabled;
      const btn = document.getElementById('micToggle');
      btn.textContent = micEnabled ? '🎤 Mic on' : '🔇 Mic off';
      btn.classList.toggle('off', !micEnabled);
    }
  });

  document.getElementById('camToggle').addEventListener('click', () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      camEnabled = !camEnabled;
      const btn = document.getElementById('camToggle');
      btn.textContent = camEnabled ? '📹 Cam on' : '🚫 Cam off';
      btn.classList.toggle('off', !camEnabled);
    }
  });

  // Priority user functionality
  const priorityBtn = document.getElementById('priorityBtn');
  let amIPriority = false;

  priorityBtn.addEventListener('click', () => {
    socket.emit('priority-user', { roomId });
  });

  socket.on('priority-user', ({ socketId, userName }) => {
    document.querySelectorAll('.remote-video-container').forEach(el => {
      el.classList.remove('priority');
    });
    
    const priorityEl = document.getElementById(`remote-${socketId}`);
    if (priorityEl) {
      priorityEl.classList.add('priority');
    }

    if (socketId === socket.id) {
      amIPriority = true;
      priorityBtn.classList.add('priority-active');
    } else {
      if (amIPriority) {
        amIPriority = false;
        priorityBtn.classList.remove('priority-active');
      }
    }
  });

  socket.on('priority-cleared', () => {
    document.querySelectorAll('.remote-video-container').forEach(el => {
      el.classList.remove('priority');
    });
    
    if (amIPriority) {
      amIPriority = false;
      priorityBtn.classList.remove('priority-active');
    }
  });

  // WebRTC Peer connections
  const peers = {};
  const remoteStreams = {};
  const remoteVideosDiv = document.getElementById('remoteVideos');

  function addRemoteVideo(socketId, userName, stream) {
    const container = document.createElement('div');
    container.id = `remote-${socketId}`;
    container.className = 'remote-video-container';

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.className = 'remote-video';

    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = userName;

    container.appendChild(video);
    container.appendChild(label);
    remoteVideosDiv.appendChild(container);
  }

  function removeRemoteVideo(socketId) {
    const el = document.getElementById(`remote-${socketId}`);
    if (el) el.remove();
    delete remoteStreams[socketId];
  }

  function createPeerConnection(targetSocketId, targetUserName) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    peers[targetSocketId] = pc;

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    pc.ontrack = (event) => {
      if (!remoteStreams[targetSocketId]) {
        remoteStreams[targetSocketId] = event.streams[0];
        addRemoteVideo(targetSocketId, targetUserName, event.streams[0]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          to: targetSocketId,
          candidate: event.candidate
        });
      }
    };

    return pc;
  }

  // WebRTC Socket events
  socket.on('existing-users', (users) => {
    users.forEach(u => {
      if (u.socketId !== socket.id) {
        const pc = createPeerConnection(u.socketId, u.userName);
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit('offer', {
              to: u.socketId,
              offer: pc.localDescription,
              fromUserName: userName
            });
          });
      }
    });
  });

  socket.on('user-joined', ({ userName, socketId }) => {
    const pc = createPeerConnection(socketId, userName);
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        socket.emit('offer', {
          to: socketId,
          offer: pc.localDescription,
          fromUserName: userName
        });
      });
  });

  socket.on('user-left', ({ socketId }) => {
    if (peers[socketId]) {
      peers[socketId].close();
      delete peers[socketId];
    }
    removeRemoteVideo(socketId);
  });

  socket.on('offer', async ({ from, fromUserName, offer }) => {
    if (!localStream) return;
    
    const pc = createPeerConnection(from, fromUserName);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    socket.emit('answer', {
      to: from,
      answer,
      fromUserName: userName
    });
  });

  socket.on('answer', async ({ from, answer }) => {
    const pc = peers[from];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  socket.on('ice-candidate', ({ from, candidate }) => {
    const pc = peers[from];
    if (pc) {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  });
})();
