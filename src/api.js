// src/api.js

// fragments microservice API to use, defaults to localhost:8080 if not set in env
const apiUrl = process.env.API_URL || 'http://localhost:8080';

/**
 * Given an authenticated user, request all fragments and their metadata for this
 * user from the fragments microservice using its authorization headers.
 */
export async function getUserFragments(user) {
  const fragmentsUrl = new URL('/v1/fragments', apiUrl);

  // Request expanded metadata instead of only fragment IDs.
  fragmentsUrl.searchParams.set('expand', '1');

  const res = await fetch(fragmentsUrl, {
    headers: user.authorizationHeaders(),
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  return data;
}

/**
 * Get the contents of a fragment.
 *
 * An optional extension can be supplied to request a converted representation,
 * for example .html, .txt, .jpg, .webp, or .gif.
 *
 * @param {Object} user authenticated user information
 * @param {string} id fragment ID
 * @param {string} extension optional conversion extension
 * @returns {Promise<Object>} response data and Content-Type
 */
export async function getFragment(user, id, extension = '') {
  const suffix = extension ? `.${extension}` : '';
  const fragmentUrl = new URL(`/v1/fragments/${id}${suffix}`, apiUrl);

  const res = await fetch(fragmentUrl, {
    headers: user.authorizationHeaders(),
  });

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;

    try {
      const error = await res.json();
      message = error.error?.message || message;
    } catch {
      // The response did not contain JSON error data.
    }

    throw new Error(message);
  }

  const contentType = res.headers.get('Content-Type') || 'application/octet-stream';

  if (contentType.startsWith('image/')) {
    return {
      contentType,
      data: await res.blob(),
    };
  }

  return {
    contentType,
    data: await res.text(),
  };
}

/**
 * Create a new fragment for the authenticated user.
 *
 * @param {Object} user authenticated user information
 * @param {string} type fragment Content-Type
 * @param {BodyInit} data fragment data
 * @returns {Promise<Object>} response metadata and Location header
 */
export async function createFragment(user, type, data) {
  const fragmentsUrl = new URL('/v1/fragments', apiUrl);

  const res = await fetch(fragmentsUrl, {
    method: 'POST',
    headers: user.authorizationHeaders(type),
    body: data,
  });

  const responseData = await res.json();

  if (!res.ok) {
    throw new Error(responseData.error?.message || `${res.status} ${res.statusText}`);
  }

  const location = res.headers.get('Location');

  return {
    data: responseData,
    location,
  };
}

/**
 * Replace the data belonging to an existing fragment.
 *
 * @param {Object} user authenticated user information
 * @param {string} id fragment ID
 * @param {string} type fragment Content-Type
 * @param {BodyInit} data replacement fragment data
 * @returns {Promise<Object>} updated fragment metadata
 */
export async function updateFragment(user, id, type, data) {
  const fragmentUrl = new URL(`/v1/fragments/${id}`, apiUrl);

  const res = await fetch(fragmentUrl, {
    method: 'PUT',
    headers: user.authorizationHeaders(type),
    body: data,
  });

  const responseData = await res.json();

  if (!res.ok) {
    throw new Error(responseData.error?.message || `${res.status} ${res.statusText}`);
  }

  return responseData;
}

/**
 * Delete an existing fragment.
 *
 * @param {Object} user authenticated user information
 * @param {string} id fragment ID
 * @returns {Promise<Object>} API success response
 */
export async function deleteFragment(user, id) {
  const fragmentUrl = new URL(`/v1/fragments/${id}`, apiUrl);

  const res = await fetch(fragmentUrl, {
    method: 'DELETE',
    headers: user.authorizationHeaders(),
  });

  const responseData = await res.json();

  if (!res.ok) {
    throw new Error(responseData.error?.message || `${res.status} ${res.statusText}`);
  }

  return responseData;
}
