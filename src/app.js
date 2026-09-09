// src/app.js

import { signIn, getUser } from './auth';
import {
  createFragment,
  deleteFragment,
  getFragment,
  getUserFragments,
  updateFragment,
} from './api';

function setStatus(element, message, state = 'info') {
  element.textContent = message;
  element.classList.remove('error', 'success');
  if (state !== 'info') element.classList.add(state);
}

let currentFragments = [];
let currentViewFragment = null;
let currentObjectUrl = null;

/**
 * Return true when the given Content-Type is an image.
 */
function isImageType(type) {
  return type.startsWith('image/');
}

/**
 * Get the supported conversion extensions for a fragment.
 */
function getConversionExtensions(type) {
  switch (type) {
    case 'text/plain':
      return ['txt'];

    case 'text/markdown':
      return ['md', 'html', 'txt'];

    case 'text/html':
      return ['html', 'txt'];

    case 'application/json':
      return ['json', 'txt'];

    case 'image/png':
    case 'image/jpeg':
    case 'image/webp':
    case 'image/gif':
      return ['png', 'jpg', 'webp', 'gif'];

    default:
      return [];
  }
}

/**
 * Clear any previous Blob URL used for image previews.
 */
function clearObjectUrl() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

/**
 * Render fragment data in the preview area.
 */
function renderFragmentData(result, preview) {
  clearObjectUrl();
  preview.replaceChildren();

  if (result.contentType.startsWith('image/')) {
    const image = document.createElement('img');

    currentObjectUrl = URL.createObjectURL(result.data);

    image.src = currentObjectUrl;
    image.alt = 'Fragment image';

    preview.appendChild(image);
    return;
  }

  const output = document.createElement('pre');
  output.textContent = result.data;

  preview.appendChild(output);
}

/**
 * View a fragment or one of its converted representations.
 */
async function viewFragment(user, fragment, extension = '') {
  const section = document.querySelector('#view-fragment');
  const status = section.querySelector('.view-status');
  const preview = section.querySelector('.fragment-preview');
  const conversionType = document.querySelector('#conversion-type');

  section.hidden = false;
  setStatus(status, 'Loading fragment...', 'info');

  section.querySelector('.view-id').textContent = fragment.id;
  section.querySelector('.view-type').textContent = fragment.type;

  currentViewFragment = fragment;

  conversionType.replaceChildren();

  const extensions = getConversionExtensions(fragment.type);

  extensions.forEach((format) => {
    const option = document.createElement('option');
    option.value = format;
    option.textContent = `.${format}`;
    conversionType.appendChild(option);
  });

  document.querySelector('#convert-fragment').disabled = extensions.length === 0;

  try {
    const result = await getFragment(user, fragment.id, extension);

    renderFragmentData(result, preview);

    setStatus(
      status,
      extension ? `Successfully converted to .${extension}.` : 'Fragment loaded successfully.',
      'success'
    );
  } catch (err) {
    preview.replaceChildren();
    setStatus(status, `Unable to load fragment: ${err.message}`, 'error');
  }

  section.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}

/**
 * Open the edit form for a fragment.
 */
async function editFragment(user, fragment) {
  const section = document.querySelector('#edit-fragment');
  const editData = document.querySelector('#edit-data');
  const editFile = document.querySelector('#edit-file');
  const textGroup = document.querySelector('#edit-text-group');
  const imageGroup = document.querySelector('#edit-image-group');
  const status = section.querySelector('.edit-status');

  section.hidden = false;

  section.dataset.fragmentId = fragment.id;
  section.dataset.fragmentType = fragment.type;

  section.querySelector('.edit-id').textContent = fragment.id;

  section.querySelector('.edit-type').textContent = fragment.type;

  setStatus(status, '', 'info');

  editData.value = '';
  editFile.value = '';

  if (isImageType(fragment.type)) {
    textGroup.hidden = true;
    imageGroup.hidden = false;
  } else {
    textGroup.hidden = false;
    imageGroup.hidden = true;

    try {
      const result = await getFragment(user, fragment.id);

      editData.value = result.data;
    } catch (err) {
      setStatus(status, `Unable to load fragment data: ${err.message}`, 'error');
    }
  }

  section.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}

/**
 * Display all fragment metadata and action buttons.
 */
function displayFragments(user, fragments, container, reloadFragments) {
  container.replaceChildren();

  if (!Array.isArray(fragments) || fragments.length === 0) {
    const message = document.createElement('p');

    message.textContent = 'No fragments were found for this user.';

    container.appendChild(message);
    return;
  }

  const table = document.createElement('table');
  const caption = document.createElement('caption');
  caption.className = 'visually-hidden';
  caption.textContent = 'Fragments in your account';
  table.appendChild(caption);

  const tableHead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  ['ID', 'Content-Type', 'Size', 'Created', 'Updated', 'Actions'].forEach((heading) => {
    const cell = document.createElement('th');

    cell.scope = 'col';
    cell.textContent = heading;
    headerRow.appendChild(cell);
  });

  tableHead.appendChild(headerRow);
  table.appendChild(tableHead);

  const tableBody = document.createElement('tbody');

  fragments.forEach((fragment) => {
    const row = document.createElement('tr');

    const values = [
      fragment.id,
      fragment.type,
      `${fragment.size} bytes`,
      fragment.created,
      fragment.updated,
    ];

    values.forEach((value) => {
      const cell = document.createElement('td');

      cell.textContent = value;
      row.appendChild(cell);
    });

    const actions = document.createElement('td');
    actions.className = 'actions';

    const viewButton = document.createElement('button');
    viewButton.type = 'button';
    viewButton.textContent = 'View';
    viewButton.className = 'secondary';
    viewButton.setAttribute('aria-label', 'View fragment ' + fragment.id);

    viewButton.addEventListener('click', () => viewFragment(user, fragment));

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.className = 'secondary';
    editButton.setAttribute('aria-label', 'Edit fragment ' + fragment.id);

    editButton.addEventListener('click', () => editFragment(user, fragment));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'danger';
    deleteButton.setAttribute('aria-label', 'Delete fragment ' + fragment.id);

    deleteButton.addEventListener('click', async () => {
      const confirmed = window.confirm(`Delete fragment ${fragment.id}?`);

      if (!confirmed) {
        return;
      }

      try {
        await deleteFragment(user, fragment.id);

        if (currentViewFragment?.id === fragment.id) {
          document.querySelector('#view-fragment').hidden = true;

          currentViewFragment = null;
          clearObjectUrl();
        }

        await reloadFragments();
      } catch (err) {
        window.alert(`Unable to delete fragment: ${err.message}`);
      }
    });

    actions.append(viewButton, editButton, deleteButton);

    row.appendChild(actions);
    tableBody.appendChild(row);
  });

  table.appendChild(tableBody);
  container.appendChild(table);
}

/**
 * Load and display expanded fragment metadata.
 */
async function loadFragments(user, statusOutput, fragmentsOutput, refreshButton) {
  refreshButton.disabled = true;
  setStatus(statusOutput, 'Loading fragments...', 'info');

  try {
    const response = await getUserFragments(user);

    currentFragments = response.fragments || [];

    displayFragments(user, currentFragments, fragmentsOutput, () =>
      loadFragments(user, statusOutput, fragmentsOutput, refreshButton)
    );

    setStatus(
      statusOutput,
      `Loaded ${currentFragments.length} fragment${currentFragments.length === 1 ? '' : 's'}.`,
      'success'
    );
  } catch (err) {
    fragmentsOutput.replaceChildren();

    setStatus(statusOutput, `Unable to load fragments: ${err.message}`, 'error');
  } finally {
    refreshButton.disabled = false;
  }
}

async function init() {
  const userSection = document.querySelector('#user');
  const loginBtn = document.querySelector('#login');

  const fragmentsSection = document.querySelector('#fragments');

  const refreshFragmentsBtn = document.querySelector('#refresh-fragments');

  const fragmentsStatus = document.querySelector('.fragments-status');

  const fragmentsList = document.querySelector('.fragments-list');

  const createFragmentSection = document.querySelector('#create-fragment');

  const fragmentForm = document.querySelector('#fragment-form');

  const fragmentType = document.querySelector('#fragment-type');

  const fragmentData = document.querySelector('#fragment-data');

  const fragmentFile = document.querySelector('#fragment-file');

  const textInputGroup = document.querySelector('#text-input-group');

  const imageInputGroup = document.querySelector('#image-input-group');

  const fragmentResult = document.querySelector('#fragment-result');

  const resultMessage = fragmentResult.querySelector('.result-message');

  const locationLink = fragmentResult.querySelector('.location');

  const metadataOutput = fragmentResult.querySelector('.metadata');

  const viewSection = document.querySelector('#view-fragment');

  const conversionType = document.querySelector('#conversion-type');

  const convertButton = document.querySelector('#convert-fragment');

  const editSection = document.querySelector('#edit-fragment');

  const editForm = document.querySelector('#edit-form');

  const editData = document.querySelector('#edit-data');

  const editFile = document.querySelector('#edit-file');

  const editStatus = editSection.querySelector('.edit-status');

  const authStatus = document.querySelector('#auth-status');
  loginBtn.onclick = async () => {
    loginBtn.disabled = true;
    setStatus(authStatus, 'Opening secure sign-in...');
    try {
      await signIn();
    } catch {
      setStatus(authStatus, 'Unable to start sign-in. Please try again.', 'error');
      loginBtn.disabled = false;
    }
  };

  let user;
  try {
    user = await getUser();
  } catch {
    setStatus(authStatus, 'Unable to complete sign-in. Please try again.', 'error');
    return;
  }

  if (!user) {
    return;
  }

  document.querySelector('#sign-in-panel').hidden = true;
  userSection.hidden = false;

  userSection.querySelector('.username').innerText = user.username;

  userSection.querySelector('.email').innerText = user.email;

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signed in';

  fragmentsSection.hidden = false;
  createFragmentSection.hidden = false;

  const reloadFragments = () =>
    loadFragments(user, fragmentsStatus, fragmentsList, refreshFragmentsBtn);

  refreshFragmentsBtn.addEventListener('click', reloadFragments);

  fragmentType.addEventListener('change', () => {
    const image = isImageType(fragmentType.value);

    textInputGroup.hidden = image;
    imageInputGroup.hidden = !image;

    fragmentData.value = '';
    fragmentFile.value = '';
  });

  fragmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    locationLink.removeAttribute('href');
    locationLink.textContent = '';
    metadataOutput.textContent = '';
    setStatus(resultMessage, '');
    fragmentResult.hidden = true;

    const type = fragmentType.value;
    let data;

    if (isImageType(type)) {
      const file = fragmentFile.files[0];

      if (!file) {
        setStatus(resultMessage, 'The fragment was not created.', 'error');

        metadataOutput.textContent = 'Choose an image file first.';

        fragmentResult.hidden = false;
        return;
      }

      if (file.type && file.type !== type) {
        setStatus(resultMessage, 'The fragment was not created.', 'error');

        metadataOutput.textContent = `Selected file type is ${file.type}, but ${type} was selected.`;

        fragmentResult.hidden = false;
        return;
      }

      data = file;
    } else {
      data = fragmentData.value;

      if (!data.trim()) {
        setStatus(resultMessage, 'Enter fragment content before creating a fragment.', 'error');
        fragmentResult.hidden = false;
        return;
      }

      if (type === 'application/json') {
        try {
          data = JSON.stringify(JSON.parse(data), null, 2);
        } catch {
          locationLink.removeAttribute('href');
          locationLink.textContent = '';

          setStatus(resultMessage, 'The fragment was not created.', 'error');

          metadataOutput.textContent = 'Invalid JSON. Check the JSON syntax and try again.';

          fragmentResult.hidden = false;
          return;
        }
      }
    }

    try {
      const result = await createFragment(user, type, data);

      if (result.location) {
        locationLink.href = result.location;
        locationLink.textContent = result.location;
      } else {
        locationLink.removeAttribute('href');

        locationLink.textContent = 'Location header was not exposed by the API.';
      }

      setStatus(resultMessage, `Successfully created a ${type} fragment.`, 'success');

      metadataOutput.textContent = JSON.stringify(result.data, null, 2);

      fragmentResult.hidden = false;

      fragmentData.value = '';
      fragmentFile.value = '';

      await reloadFragments();
    } catch (err) {
      locationLink.removeAttribute('href');
      locationLink.textContent = '';

      setStatus(resultMessage, 'The fragment was not created.', 'error');

      metadataOutput.textContent = `Unable to create fragment: ${err.message}`;

      fragmentResult.hidden = false;
    }
  });

  convertButton.addEventListener('click', async () => {
    if (!currentViewFragment) {
      return;
    }

    await viewFragment(user, currentViewFragment, conversionType.value);
  });

  document.querySelector('#close-view').addEventListener('click', () => {
    viewSection.hidden = true;
    currentViewFragment = null;

    clearObjectUrl();
  });

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = editSection.dataset.fragmentId;
    const type = editSection.dataset.fragmentType;

    if (!id || !type) {
      return;
    }

    let data;

    if (isImageType(type)) {
      const file = editFile.files[0];

      if (!file) {
        setStatus(editStatus, 'Choose a replacement image first.', 'error');

        return;
      }

      if (file.type && file.type !== type) {
        setStatus(editStatus, `Replacement image must remain ${type}.`, 'error');

        return;
      }

      data = file;
    } else {
      data = editData.value;

      if (type === 'application/json') {
        try {
          data = JSON.stringify(JSON.parse(data), null, 2);
        } catch {
          setStatus(editStatus, 'Invalid JSON.', 'error');

          return;
        }
      }
    }

    setStatus(editStatus, 'Updating fragment...', 'info');

    try {
      await updateFragment(user, id, type, data);

      setStatus(editStatus, 'Fragment updated successfully.', 'success');

      await reloadFragments();

      const updatedFragment = currentFragments.find((fragment) => fragment.id === id);

      if (updatedFragment) {
        await viewFragment(user, updatedFragment);
      }

      editSection.hidden = true;
    } catch (err) {
      setStatus(editStatus, `Unable to update fragment: ${err.message}`, 'error');
    }
  });

  document.querySelector('#cancel-edit').addEventListener('click', () => {
    editSection.hidden = true;
    setStatus(editStatus, '', 'info');
  });

  await reloadFragments();
}

addEventListener('DOMContentLoaded', init);
