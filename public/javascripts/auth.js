// Authentication page utilities
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  
  const form = document.querySelector('form');
  form.insertBefore(errorDiv, form.firstChild);
}

function validateLoginForm() {
  const username = document.querySelector('input[name="username"]').value.trim();
  const password = document.querySelector('input[name="password"]').value.trim();
  
  if (!username) {
    showError('Username is required');
    return false;
  }
  
  if (!password) {
    showError('Password is required');
    return false;
  }
  
  return true;
}

function validateRegisterForm() {
  const username = document.querySelector('input[name="username"]').value.trim();
  const password = document.querySelector('input[name="password"]').value.trim();
  const name = document.querySelector('input[name="name"]').value.trim();
  
  if (!username) {
    showError('Username is required');
    return false;
  }
  
  if (username.length < 3) {
    showError('Username must be at least 3 characters');
    return false;
  }
  
  if (!password) {
    showError('Password is required');
    return false;
  }
  
  if (password.length < 6) {
    showError('Password must be at least 6 characters');
    return false;
  }
  
  return true;
}

// Add form validation
document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.querySelector('form[action="/login"]');
  const registerForm = document.querySelector('form[action="/register"]');
  
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      if (!validateLoginForm()) {
        e.preventDefault();
      }
    });
  }
  
  if (registerForm) {
    registerForm.addEventListener('submit', function(e) {
      if (!validateRegisterForm()) {
        e.preventDefault();
      }
    });
  }
  
  // Add input animations
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('focus', function() {
      this.parentElement.classList.add('focused');
    });
    
    input.addEventListener('blur', function() {
      if (!this.value) {
        this.parentElement.classList.remove('focused');
      }
    });
  });
});
