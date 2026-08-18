/* ===================================================================
   construiten1cli — script.js
   Comportements : recherche produits, compteur panier,
   envoi du formulaire de devis (AJAX), petites UX (scroll header).
   =================================================================== */

document.addEventListener('DOMContentLoaded', function () {

  /* -----------------------------------------------------------
     1. RECHERCHE PRODUITS
     Empêche le rechargement de page et redirige vers une page
     de résultats avec la catégorie et le terme en paramètres.
  ----------------------------------------------------------- */
  var searchForm = document.getElementById('search-form');
  var searchInput = document.getElementById('search-input');
  var catSelect = document.getElementById('cat-select');

  if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var query = searchInput.value.trim();
      var category = catSelect.value;

      if (query === '') {
        searchInput.focus();
        return;
      }

      var params = new URLSearchParams();
      params.set('q', query);
      if (category && category !== 'Toutes catégories') {
        params.set('categorie', category);
      }

      // Redirection vers la page de résultats (à adapter selon le backend)
      window.location.href = 'recherche.php?' + params.toString();
    });
  }

  /* -----------------------------------------------------------
     2. PANIER
     Gère le compteur d'articles affiché dans le header.
     Le panier réel (contenu, total) est à connecter à votre
     backend / base de données produits.
  ----------------------------------------------------------- */
  var cartCountEl = document.getElementById('cart-count');
  var cartLinkEl = document.getElementById('cart-link');
  var CART_ITEMS_KEY = 'c1c_cart_items';
  var CART_CLICKS_KEY = 'c1c_cart_clicks';

  // Mémoire vive de secours : utilisée si sessionStorage est
  // indisponible ou bloqué (aperçu en iframe, navigation privée...).
  // Le compteur fonctionne toujours pendant la session en cours,
  // même sans stockage persistant.
  var memoryClickCount = 0;
  var memoryCartItems = [];

  function storageAvailable() {
    try {
      return typeof window !== 'undefined' && !!window.sessionStorage;
    } catch (err) {
      return false;
    }
  }

  // Bulle de notification ancrée sur l'icône panier (#cart-link)
  function raf(fn) {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(fn);
    } else {
      setTimeout(fn, 16);
    }
  }

  function showCartNotification(message) {
    if (!cartLinkEl) return;

    var bubble = cartLinkEl.querySelector('.cart-bubble');
    if (!bubble) {
      bubble = document.createElement('span');
      bubble.className = 'cart-bubble';
      bubble.setAttribute('role', 'status');
      bubble.setAttribute('aria-live', 'polite');
      cartLinkEl.appendChild(bubble);
    }

    bubble.textContent = message;

    clearTimeout(bubble._hideTimeout);

    raf(function () {
      bubble.className = 'cart-bubble is-visible';
    });

    bubble._hideTimeout = setTimeout(function () {
      bubble.className = 'cart-bubble';
    }, 2000);

    // Flash lumineux sur l'ensemble du bouton panier
    cartLinkEl.className = cartLinkEl.className.replace(/\s*cart-flash\s*/g, ' ');
    // force reflow pour pouvoir rejouer l'animation si cliqué plusieurs fois de suite
    void cartLinkEl.offsetWidth;
    cartLinkEl.className += ' cart-flash';
  }

  function getCartItems() {
    if (!storageAvailable()) return memoryCartItems;
    try {
      var stored = sessionStorage.getItem(CART_ITEMS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      return memoryCartItems;
    }
  }

  function saveCartItems(items) {
    memoryCartItems = items;
    if (storageAvailable()) {
      try {
        sessionStorage.setItem(CART_ITEMS_KEY, JSON.stringify(items));
      } catch (err) {
        // stockage indisponible : on continue avec la mémoire vive
      }
    }
  }

  // Compteur global : nombre total de clics sur "Ajouter au panier",
  // tous produits confondus. C'est cette valeur qui s'affiche sur
  // l'icône panier (#cart-count).
  function getClickCount() {
    if (!storageAvailable()) return memoryClickCount;
    try {
      var stored = sessionStorage.getItem(CART_CLICKS_KEY);
      return stored ? parseInt(stored, 10) : memoryClickCount;
    } catch (err) {
      return memoryClickCount;
    }
  }

  function setClickCount(count) {
    memoryClickCount = count;

    if (storageAvailable()) {
      try {
        sessionStorage.setItem(CART_CLICKS_KEY, count);
      } catch (err) {
        // stockage indisponible : on continue avec la mémoire vive
      }
    }

    if (cartCountEl) {
      cartCountEl.textContent = count;
    }
  }

  function renderCartCount() {
    setClickCount(getClickCount());
  }

  // Initialisation du compteur au chargement
  renderCartCount();

  // Fonction exposée pour ajouter un article au panier.
  // productInfo (optionnel) : { id, name, price, image } pour
  // enrichir la ligne stockée ; sinon seul le compteur est incrémenté.
  window.addToCart = function (productId, quantity, productInfo) {
    quantity = quantity || 1;

    var items = getCartItems();
    var existing = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === productId) {
        existing = items[i];
        break;
      }
    }

    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        id: productId,
        name: (productInfo && productInfo.name) || productId,
        price: (productInfo && productInfo.price) || 0,
        image: (productInfo && productInfo.image) || '',
        quantity: quantity
      });
    }

    // Nombre total de clics enregistrés pour ce produit précis
    var clicksForThisProduct = existing ? existing.quantity : quantity;

    saveCartItems(items);

    // Incrémente le compteur global de clics (affiché sur l'icône panier)
    var newClickCount = getClickCount() + 1;
    setClickCount(newClickCount);

    // Petit effet visuel de confirmation sur le badge
    if (cartCountEl) {
      cartCountEl.className = cartCountEl.className.replace(/\s*bump\s*/g, ' ');
      void cartCountEl.offsetWidth;
      cartCountEl.className += ' bump';
    }

    // Notification visible directement au niveau du panier,
    // avec le nombre de clics cumulés sur ce produit précis
    var label = (productInfo && productInfo.name) ? productInfo.name : 'Produit';
    showCartNotification(label + ' ajouté ✓ (×' + clicksForThisProduct + ')');
  };

  // Fonction exposée pour consulter le contenu actuel du panier
  // (utile pour une future page panier.html / panier.php)
  window.getCart = function () {
    return getCartItems();
  };

  /* -----------------------------------------------------------
     2bis. BOUTON "AJOUTER AU PANIER" SUR CHAQUE PRODUIT
     Insère dynamiquement un bouton en bas de chaque carte .cat-card
     (sans toucher au HTML). Chaque clic sur ce bouton ajoute le
     produit au panier et déclenche la notification au niveau de
     l'icône panier (#cart-link), avec le nombre de clics cumulés
     sur ce produit précis.
  ----------------------------------------------------------- */
  var productCards = document.querySelectorAll('.cat-card');

  if (!productCards.length) {
    console.warn('construiten1cli : aucune carte .cat-card trouvée — le bouton "Ajouter au panier" ne peut pas être inséré.');
  }

  function slugify(text) {
    var result = text.toString().toLowerCase();
    try {
      // enlève les accents (méthode récente : protégée par try/catch
      // au cas où le moteur d'aperçu ne la supporterait pas)
      result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (err) {
      // pas grave si l'accent reste, le slug fonctionne quand même
    }
    result = result
      .replace(/^\s+|\s+$/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return result;
  }

  function extractPrice(text) {
    if (!text) return 0;
    var digits = text.replace(/[^0-9]/g, '');
    return digits ? parseInt(digits, 10) : 0;
  }

  productCards.forEach(function (card) {
    // Désactive définitivement la navigation du lien parent (href="#") :
    // plus fiable que preventDefault() dans un moteur d'aperçu limité.
    card.removeAttribute('href');

    var nameEl = card.querySelector('h3');
    var priceEl = card.querySelector('.cat-price');
    var imgEl = card.querySelector('.cat-icon img');

    var name = nameEl ? nameEl.textContent.replace(/^\s+|\s+$/g, '') : 'Produit';
    var priceText = priceEl ? priceEl.textContent.replace(/^\s+|\s+$/g, '') : '';
    var productId = (card.getAttribute('data-product-id')) || slugify(name);

    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'cat-add-btn';
    addBtn.textContent = 'Ajouter au panier';
    addBtn.setAttribute('aria-label', 'Ajouter ' + name + ' au panier');

    addBtn.onclick = function (e) {
      if (e && e.preventDefault) { e.preventDefault(); }
      if (e && e.stopPropagation) { e.stopPropagation(); }

      var product = {
        id: productId,
        name: name,
        price: extractPrice(priceText),
        image: imgEl ? imgEl.getAttribute('src') : ''
      };

      window.addToCart(product.id, 1, product);
      return false;
    };

    card.appendChild(addBtn);
  });

  /* -----------------------------------------------------------
     3. FORMULAIRE DE DEVIS
     Envoi asynchrone vers devis.php + message de statut
     accessible (aria-live déjà présent dans le HTML).
  ----------------------------------------------------------- */
  var devisForm = document.getElementById('devis-form');
  var devisInput = document.getElementById('devis-input');
  var devisStatus = document.getElementById('devis-status');

  function showDevisStatus(message, isError) {
    if (!devisStatus) return;
    devisStatus.textContent = message;
    devisStatus.classList.remove('sr-only');
    devisStatus.classList.toggle('is-error', !!isError);
    devisStatus.classList.toggle('is-success', !isError);
  }

  if (devisForm) {
    devisForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var contact = devisInput.value.trim();

      if (contact === '') {
        showDevisStatus('Merci de renseigner un email ou un numéro WhatsApp.', true);
        devisInput.focus();
        return;
      }

      // Pas de backend : on ouvre WhatsApp avec un message pré-rempli
      // contenant les coordonnées saisies, pour que la demande de
      // devis arrive directement dans la messagerie de l'entreprise.
      var message = 'Bonjour, je souhaite un devis matériaux de construction. Mes coordonnées : ' + contact;
      var waUrl = 'https://wa.me/2290147282166?text=' + encodeURIComponent(message);

      showDevisStatus('Redirection vers WhatsApp…', false);
      window.open(waUrl, '_blank', 'noopener');
      devisForm.reset();
    });
  }

  /* -----------------------------------------------------------
     4. HEADER : ombre au scroll
     Ajoute une classe "scrolled" au header sticky pour donner
     un léger relief une fois la page défilée (à styler en CSS
     si besoin via .main.scrolled).
  ----------------------------------------------------------- */
  var mainHeader = document.querySelector('header.main');

  function handleHeaderScroll() {
    if (!mainHeader) return;
    if (window.scrollY > 8) {
      mainHeader.classList.add('scrolled');
    } else {
      mainHeader.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleHeaderScroll, { passive: true });
  handleHeaderScroll();

  /* -----------------------------------------------------------
     5. LIENS D'ANCRAGE (catégories, devis)
     Défilement doux déjà géré en CSS (scroll-behavior: smooth),
     ce bloc gère uniquement le focus accessible après le scroll.
  ----------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function () {
      var targetId = link.getAttribute('href').slice(1);
      var target = document.getElementById(targetId);
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.addEventListener('blur', function handleBlur() {
          target.removeAttribute('tabindex');
          target.removeEventListener('blur', handleBlur);
        });
        setTimeout(function () {
          target.focus({ preventScroll: true });
        }, 400);
      }
    });
  });

});
