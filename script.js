(function () {
  function init() {
    const fileInput = document.getElementById('fileInput');
    const convertBtn = document.getElementById('convertBtn');

    if (!fileInput || !convertBtn) {
      console.error('fileInput or convertBtn not found!');
      return;
    }

    convertBtn.addEventListener('click', () => {
      console.log('Convert button clicked'); // <-- Debug check

      if (!fileInput.files || fileInput.files.length === 0) {
        alert('No file selected!');
        console.log('No file selected'); // <-- Debug check
        return;
      }

      const file = fileInput.files[0];
      console.log('File selected:', file.name); // <-- Debug check
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
