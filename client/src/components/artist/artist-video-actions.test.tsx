import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArtistVideoActions } from './artist-video-actions';
import { Router } from 'wouter';

const defaults = {
  videoId: 'fixture', isOwner: false, canDownload: false, hasScript: false, uploading: false, accentColor: '#f97316',
  onDownload() {}, onViewScript() {}, onUploadScript() {}, onDelete() {},
};

test('fans see available download and script controls but never owner actions', () => {
  const html = renderToStaticMarkup(<Router ssrPath="/"><ArtistVideoActions {...defaults} canDownload hasScript /></Router>);
  assert.match(html, /aria-label="Download video"/);
  assert.match(html, /aria-label="View video script"/);
  assert.doesNotMatch(html, /aria-label="(?:Promote video|Delete video|Upload video script)/);
});

test('owners get a labeled script upload, promotion and delete without a script', () => {
  const html = renderToStaticMarkup(<Router ssrPath="/"><ArtistVideoActions {...defaults} isOwner canDownload /></Router>);
  assert.match(html, /aria-label="Upload video script \(PDF\)"/);
  assert.match(html, /aria-label="Promote video"/);
  assert.match(html, /aria-label="Delete video"/);
  assert.doesNotMatch(html, /aria-label="View video script"/);
});

test('upload is disabled during upload and viewing replaces upload when script exists', () => {
  const pending = renderToStaticMarkup(<Router ssrPath="/"><ArtistVideoActions {...defaults} isOwner uploading /></Router>);
  assert.match(pending, /aria-label="Upload video script \(PDF\)"[^>]*disabled/);
  const saved = renderToStaticMarkup(<Router ssrPath="/"><ArtistVideoActions {...defaults} isOwner hasScript /></Router>);
  assert.match(saved, /aria-label="View video script"/);
  assert.doesNotMatch(saved, /aria-label="Upload video script/);
});
