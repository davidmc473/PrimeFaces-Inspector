"use strict";
(() => {
  // src/content/ui/icons.js
  var ATTRS = `fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`;
  function svg(size, content) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ${ATTRS} aria-hidden="true">${content}</svg>`;
  }
  var PATHS = {
    /* ── Iconos de interfaz ── */
    "x": '<path d="M6 18 18 6M6 6l12 12"/>',
    "chevron-right": '<path d="m8.25 4.5 7.5 7.5-7.5 7.5"/>',
    "arrow-left": '<path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/>',
    "play": '<path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"/>',
    "terminal": '<path d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z"/>',
    "search": '<path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>',
    "filter": '<path d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"/>',
    "maximize-2": '<path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/>',
    "copy": '<path d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"/>',
    "crosshair": '<path d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>',
    "rotate-ccw": '<path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>',
    "settings": '<path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>',
    "globe": '<path d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"/>',
    "sun": '<path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"/>',
    "moon": '<path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/>',
    "zap": '<path d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"/>',
    "bookmark": '<path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"/>',
    "info": '<path d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/>',
    "github": '<path stroke-width="2" d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
    "alert-triangle": '<path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>',
    "check-circle": '<path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>',
    "check": '<path d="m4.5 12.75 6 6 9-13.5"/>',
    "activity": '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    "pause": '<path d="M15.75 5.25v13.5m-7.5-13.5v13.5"/>',
    "trash": '<path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/>',
    /* ── Iconos de categoría de componente ── */
    "table-cells": '<path d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5"/>',
    "cursor-rays": '<path d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59"/>',
    "window": '<path d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M5.25 6h.008v.008H5.25V6ZM7.5 6h.008v.008H7.5V6Zm2.25 0h.008v.008H9.75V6Z"/>',
    "squares": '<path d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"/>',
    "pencil-square": '<path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/>',
    "calculator": '<path d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V13.5Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V18Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V13.5Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V18Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm2.498-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0 0 12 2.25Z"/>',
    "calendar": '<path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"/>',
    "clock": '<path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>',
    "chevron-updown": '<path d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"/>',
    "upload": '<path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>',
    "queue-list": '<path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"/>',
    "bars": '<path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>',
    "bell": '<path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/>',
    "chart-bar": '<path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>',
    "chart-pie": '<path d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z"/><path d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z"/>',
    "photo": '<path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/>',
    "star": '<path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/>',
    "swatch": '<path d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z"/>',
    "arrows-lr": '<path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/>',
    "arrows-ud": '<path d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"/>',
    "ellipsis": '<path d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/>',
    "lock": '<path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/>',
    "cube": '<path d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>',
    "rectangle-stack": '<path d="M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 0 0 4.5 9v.878m13.5-3A2.25 2.25 0 0 1 19.5 9v.878m0 0a2.246 2.246 0 0 0-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0 1 21 12v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6c0-.98.626-1.813 1.5-2.122"/>',
    "list-bullet": '<path d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/>',
    "document-text": '<path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>',
    "hashtag": '<path d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5"/>',
    "adjustments": '<path d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"/>',
    "chat": '<path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"/>'
  };
  function icon(name, size = 14) {
    return svg(size, PATHS[name] || PATHS["x"]);
  }
  var COMPONENT_ICON_MAP = {
    DataTable: "table-cells",
    CommandButton: "cursor-rays",
    CommandLink: "cursor-rays",
    Dialog: "window",
    Panel: "squares",
    TabView: "rectangle-stack",
    InputNumber: "calculator",
    InputMask: "pencil-square",
    InputText: "pencil-square",
    InputTextarea: "document-text",
    Calendar: "calendar",
    DatePicker: "calendar",
    TimePicker: "clock",
    SelectOneMenu: "chevron-updown",
    SelectBooleanCheckbox: "check-circle",
    SelectManyCheckbox: "check-circle",
    AutoComplete: "search",
    FileUpload: "upload",
    Tree: "list-bullet",
    TreeTable: "table-cells",
    AccordionPanel: "rectangle-stack",
    Menu: "bars",
    Menubar: "bars",
    ContextMenu: "bars",
    Growl: "bell",
    Messages: "chat",
    Message: "chat",
    OverlayPanel: "window",
    Tooltip: "chat",
    ProgressBar: "chart-bar",
    Chart: "chart-pie",
    Schedule: "calendar",
    Carousel: "photo",
    Galleria: "photo",
    Editor: "pencil-square",
    Spinner: "calculator",
    Slider: "adjustments",
    Rating: "star",
    ColorPicker: "swatch",
    Chips: "hashtag",
    PickList: "arrows-lr",
    OrderList: "arrows-ud",
    DataList: "list-bullet",
    DataGrid: "squares",
    DataScroller: "queue-list",
    Paginator: "ellipsis",
    Fieldset: "squares",
    ConfirmDialog: "window",
    Sidebar: "window",
    Inplace: "pencil-square",
    BlockUI: "lock",
    Poll: "rotate-ccw",
    RemoteCommand: "zap",
    OutputPanel: "squares",
    AjaxStatus: "rotate-ccw",
    Fragment: "cube",
    Default: "cube"
  };
  var ICON_KEYS = Object.keys(COMPONENT_ICON_MAP).filter((k) => k !== "Default").sort((a, b) => b.length - a.length);
  function getComponentIcon(type, size = 18) {
    if (!type) return icon(COMPONENT_ICON_MAP.Default, size);
    const low = type.toLowerCase();
    for (const key of ICON_KEYS) {
      if (low.includes(key.toLowerCase())) return icon(COMPONENT_ICON_MAP[key], size);
    }
    return icon(COMPONENT_ICON_MAP.Default, size);
  }

  // src/content/ui/utils.js
  function escHtml(str) {
    if (str === null || str === void 0) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function escAttr(str) {
    return escHtml(str);
  }

  // src/i18n/en.js
  var en_default = {
    title: "PrimeFaces Inspector",
    searchPlaceholder: "Search widgetVar, id, type\u2026",
    filterAll: "All types",
    filterMulti: "{0} selected",
    filterButton: "Filter",
    filterClear: "Clear",
    noWidgets: "No PrimeFaces widgets found.",
    pfNotDetected: "PrimeFaces not detected on this page.",
    pfDetected: "PrimeFaces {0}",
    pfExtDetected: "PF Extensions {0}",
    pfExtNotDetected: "PF Extensions not detected.",
    jqueryMissing: "(jQuery not found)",
    btnSelect: "Selection mode (Ctrl+Shift)",
    btnMonitor: "Monitor (Ajax & events)",
    btnConfig: "Settings",
    btnRefresh: "Refresh",
    btnClose: "Close",
    back: "Back",
    expand: "Expand",
    collapse: "Collapse",
    sectionInfo: "General information",
    sectionMetadata: "Metadata",
    sectionTarget: "Target",
    sectionClientApi: "Client API",
    sectionEvents: "Events",
    eventsEmpty: "No events detected.",
    eventsJqueryDisabled: "jQuery events disabled in settings.",
    btnExecEvent: "Execute this event",
    labelWidgetVar: "widgetVar",
    labelId: "ID",
    labelType: "Type",
    labelTargetId: "Target ID",
    thLetter: "Key",
    thMeaning: "Meaning",
    thDescription: "Description",
    thValue: "Value",
    sourceInline: "inline",
    sourceJquery: "jQuery",
    execOk: "\u2713 PF('{0}').{1}() executed",
    execOkResult: "\u2713 PF('{0}').{1}() \u2192 {2}",
    execErr: "\u2717 Error: {0}",
    openConfig: "Open settings",
    disabledAlready: "widget is already disabled",
    enabledAlready: "widget is already enabled",
    shownAlready: "widget is already visible",
    hiddenAlready: "widget is already hidden",
    viewFull: "View full",
    resultTitle: "Result",
    copyResult: "Copy",
    copied: "Copied to clipboard",
    apiOpenForm: "Open form for {0}() \u2014 {1} arg(s)",
    argPlaceholder: "e.g. 2, 'text', true, [1,2]",
    argHint: "Valid JSON or plain text. Empty = skip argument.",
    btnExec: "Execute",
    btnCancel: "Cancel",
    executing: "Executing\u2026",
    returnedValue: "Returned value",
    cfgTitle: "Settings",
    cfgSectionAppearance: "Appearance",
    cfgSectionAjax: "Ajax Monitoring",
    cfgSectionBehavior: "Behavior",
    cfgSectionAbout: "About",
    cfgTheme: "Light theme",
    cfgThemeDesc: "Switch between dark and light mode.",
    cfgUpdates: "Highlight Updates",
    cfgUpdatesDesc: "Flash elements updated by an Ajax response.",
    cfgProcess: "Highlight Process",
    cfgProcessDesc: "Flash elements processed by PrimeFaces.ab().",
    cfgColorUpdate: "Update color",
    cfgColorProcess: "Process color",
    cfgPersist: "Persist panel",
    cfgPersistDesc: "Keep the panel open across page navigation.",
    cfgShowJquery: "Show jQuery events",
    cfgShowJqueryDesc: "Display events bound via jQuery in the widget detail.",
    cfgLanguage: "Language",
    cfgLangAuto: "Auto (browser)",
    cfgLangEn: "English",
    cfgLangEs: "Spanish",
    cfgAbout: "About",
    cfgVersion: "Version",
    cfgRepo: "Repository",
    cfgReset: "Reset colors",
    monTitle: "Monitor",
    monTabAjax: "Ajax",
    monTabEvents: "Events",
    monClear: "Clear log",
    monLiveOn: "Live",
    monLiveOff: "Capture",
    monLiveStart: "Start live event capture",
    monLiveStop: "Stop event capture",
    monAjaxEmpty: "No Ajax requests recorded yet. Interact with the page to see them here.",
    monEventsEmpty: "Capture is on: interact with the widgets to record their events.",
    monEventsPaused: 'Capture is paused. Press "Capture" to record events live.',
    monPending: "pending",
    monStatus: "Status",
    monDuration: "Duration",
    monErrorMsg: "Error",
    monUpdatesApplied: "Applied updates",
    monRequest: "Request payload",
    monResponse: "Response",
    ctxNoWidget: "No PrimeFaces widget under the cursor.",
    dtConnecting: "Connecting to the page\u2026",
    dtCannotInspect: "This page cannot be inspected.",
    dtBtnFloating: "Open/close the floating panel on the page",
    dtHighlight: "Highlight on the page",
    dtOpenDetail: "Open the detail in the in-page panel",
    dtNoMethods: "No callable methods.",
    dtMetaEmpty: "No metadata."
  };

  // src/i18n/es.js
  var es_default = {
    title: "PrimeFaces Inspector",
    searchPlaceholder: "Buscar widgetVar, id, tipo\u2026",
    filterAll: "Todos los tipos",
    filterMulti: "{0} seleccionados",
    filterButton: "Filtro",
    filterClear: "Limpiar",
    noWidgets: "No se encontraron widgets de PrimeFaces.",
    pfNotDetected: "PrimeFaces no detectado en esta p\xE1gina.",
    pfDetected: "PrimeFaces {0}",
    pfExtDetected: "PF Extensions {0}",
    pfExtNotDetected: "PF Extensions no detectado.",
    jqueryMissing: "(jQuery no encontrado)",
    btnSelect: "Modo selecci\xF3n (Ctrl+Shift)",
    btnMonitor: "Monitor (Ajax y eventos)",
    btnConfig: "Configuraci\xF3n",
    btnRefresh: "Actualizar",
    btnClose: "Cerrar",
    back: "Volver",
    expand: "Expandir",
    collapse: "Contraer",
    sectionInfo: "Informaci\xF3n general",
    sectionMetadata: "Metadatos",
    sectionTarget: "Target",
    sectionClientApi: "Client API",
    sectionEvents: "Eventos",
    eventsEmpty: "Sin eventos detectados.",
    eventsJqueryDisabled: "Eventos jQuery desactivados en la configuraci\xF3n.",
    btnExecEvent: "Ejecutar este evento",
    labelWidgetVar: "widgetVar",
    labelId: "ID",
    labelType: "Tipo",
    labelTargetId: "Target ID",
    thLetter: "Letra",
    thMeaning: "Significado",
    thDescription: "Descripci\xF3n",
    thValue: "Valor",
    sourceInline: "inline",
    sourceJquery: "jQuery",
    execOk: "\u2713 PF('{0}').{1}() ejecutado",
    execOkResult: "\u2713 PF('{0}').{1}() \u2192 {2}",
    execErr: "\u2717 Error: {0}",
    openConfig: "Abrir configuraci\xF3n",
    disabledAlready: "el widget ya est\xE1 deshabilitado",
    enabledAlready: "el widget ya est\xE1 habilitado",
    shownAlready: "el widget ya es visible",
    hiddenAlready: "el widget ya est\xE1 oculto",
    viewFull: "Ver completo",
    resultTitle: "Resultado",
    copyResult: "Copiar",
    copied: "Copiado al portapapeles",
    apiOpenForm: "Abrir formulario para {0}() \u2014 {1} argumento(s)",
    argPlaceholder: "p.ej. 2, 'texto', true, [1,2]",
    argHint: "JSON v\xE1lido o texto plano. Vac\xEDo = omitir argumento.",
    btnExec: "Ejecutar",
    btnCancel: "Cancelar",
    executing: "Ejecutando\u2026",
    returnedValue: "Valor devuelto",
    cfgTitle: "Configuraci\xF3n",
    cfgSectionAppearance: "Apariencia",
    cfgSectionAjax: "Monitoreo Ajax",
    cfgSectionBehavior: "Comportamiento",
    cfgSectionAbout: "Acerca de",
    cfgTheme: "Tema claro",
    cfgThemeDesc: "Cambiar entre modo oscuro y claro.",
    cfgUpdates: "Highlight Actualizaciones",
    cfgUpdatesDesc: "Resaltar elementos actualizados por respuesta Ajax.",
    cfgProcess: "Highlight Process",
    cfgProcessDesc: "Resaltar elementos procesados al llamar PrimeFaces.ab().",
    cfgColorUpdate: "Color de actualizaci\xF3n",
    cfgColorProcess: "Color de process",
    cfgPersist: "Persistir panel",
    cfgPersistDesc: "Mantener el panel abierto al navegar entre p\xE1ginas.",
    cfgShowJquery: "Mostrar eventos jQuery",
    cfgShowJqueryDesc: "Mostrar en el detalle del widget los eventos enlazados con jQuery.",
    cfgLanguage: "Idioma",
    cfgLangAuto: "Auto (navegador)",
    cfgLangEn: "Ingl\xE9s",
    cfgLangEs: "Espa\xF1ol",
    cfgAbout: "Acerca de",
    cfgVersion: "Versi\xF3n",
    cfgRepo: "Repositorio",
    cfgReset: "Restablecer colores",
    monTitle: "Monitor",
    monTabAjax: "Ajax",
    monTabEvents: "Eventos",
    monClear: "Limpiar registro",
    monLiveOn: "En vivo",
    monLiveOff: "Capturar",
    monLiveStart: "Iniciar la captura de eventos en vivo",
    monLiveStop: "Detener la captura de eventos",
    monAjaxEmpty: "Sin peticiones Ajax registradas todav\xEDa. Interact\xFAa con la p\xE1gina para verlas aqu\xED.",
    monEventsEmpty: "Captura activa: interact\xFAa con los widgets para registrar sus eventos.",
    monEventsPaused: 'La captura est\xE1 pausada. Pulsa "Capturar" para registrar los eventos en vivo.',
    monPending: "pendiente",
    monStatus: "Estado",
    monDuration: "Duraci\xF3n",
    monErrorMsg: "Error",
    monUpdatesApplied: "Updates aplicados",
    monRequest: "Payload de la petici\xF3n",
    monResponse: "Respuesta",
    ctxNoWidget: "Ning\xFAn widget PrimeFaces bajo el cursor.",
    dtConnecting: "Conectando con la p\xE1gina\u2026",
    dtCannotInspect: "No se puede inspeccionar esta p\xE1gina.",
    dtBtnFloating: "Abrir/cerrar el panel flotante en la p\xE1gina",
    dtHighlight: "Resaltar en la p\xE1gina",
    dtOpenDetail: "Abrir el detalle en el panel de la p\xE1gina",
    dtNoMethods: "Sin m\xE9todos ejecutables.",
    dtMetaEmpty: "Sin metadatos."
  };

  // src/devtools/panel.js
  var dict = (navigator.language || "en").toLowerCase().startsWith("es") ? es_default : en_default;
  function t(key, ...args) {
    let s = dict[key] !== void 0 ? dict[key] : en_default[key] !== void 0 ? en_default[key] : key;
    args.forEach((v, i) => {
      s = s.replace("{" + i + "}", v);
    });
    return s;
  }
  var tabId = chrome.devtools.inspectedWindow.tabId;
  var port = null;
  var widgets = [];
  var pageInfo = null;
  var cannotInspect = false;
  var searchTerm = "";
  var typeFilter = "";
  var expandedVar = null;
  var ajaxTimer = null;
  function connect() {
    port = chrome.runtime.connect({ name: "pfi-devtools" });
    port.postMessage({ type: "init", tabId });
    port.onMessage.addListener(onRelayMessage);
    port.onDisconnect.addListener(() => {
      port = null;
      setTimeout(connect, 400);
    });
  }
  function sendToPage(message) {
    if (!port) return;
    try {
      port.postMessage({ type: "toTab", message });
    } catch (e) {
    }
  }
  function collect() {
    cannotInspect = false;
    sendToPage({ action: "pfiDevtoolsCollect" });
  }
  function onRelayMessage(msg) {
    if (!msg) return;
    if (msg.type === "pfiError") {
      cannotInspect = true;
      renderInfo();
      return;
    }
    if (msg.kind === "data") {
      widgets = msg.data || [];
      if (msg.info) pageInfo = msg.info;
      cannotInspect = false;
      renderInfo();
      renderTypeOptions();
      renderList();
    } else if (msg.kind === "ajax") {
      clearTimeout(ajaxTimer);
      ajaxTimer = setTimeout(collect, 500);
    }
  }
  function buildSkeleton() {
    const app = document.getElementById("app");
    app.innerHTML = `
    <div class="dtp-header">
      <svg class="dtp-logo" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="var(--accent)" stroke-width="1.5" fill="var(--accent-bg)"/>
        <text x="12" y="16" text-anchor="middle" fill="var(--accent)" font-size="10" font-weight="700" font-family="sans-serif">PF</text>
      </svg>
      <span class="dtp-title">${escHtml(t("title"))}</span>
      <span class="dtp-count" id="dtp-count"></span>
      <button class="dtp-btn" id="dtp-btn-floating" title="${escAttr(t("dtBtnFloating"))}">${icon("maximize-2", 14)}</button>
      <button class="dtp-btn" id="dtp-btn-refresh" title="${escAttr(t("btnRefresh"))}">${icon("rotate-ccw", 14)}</button>
    </div>
    <div class="dtp-info" id="dtp-info"></div>
    <div class="dtp-toolbar" id="dtp-toolbar">
      <div class="dtp-search-wrap">
        ${icon("search", 13)}
        <input type="text" id="dtp-search" placeholder="${escAttr(t("searchPlaceholder"))}" spellcheck="false">
      </div>
      <select id="dtp-type" title="${escAttr(t("filterButton"))}"></select>
    </div>
    <div class="dtp-list" id="dtp-list"></div>
  `;
    app.querySelector("#dtp-btn-refresh").addEventListener("click", collect);
    app.querySelector("#dtp-btn-floating").addEventListener("click", () => {
      sendToPage({ action: "togglePanel" });
    });
    app.querySelector("#dtp-search").addEventListener("input", (e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      renderList();
    });
    app.querySelector("#dtp-type").addEventListener("change", (e) => {
      typeFilter = e.target.value;
      renderList();
    });
    app.querySelector("#dtp-list").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (btn) {
        const card = btn.closest(".dtp-card");
        const w = widgets.find((x) => x.widgetVar === card.dataset.var);
        if (!w) return;
        if (btn.dataset.act === "highlight") {
          sendToPage({ action: "pfiDevtoolsHighlight", id: w.id });
        } else if (btn.dataset.act === "open") {
          sendToPage({ action: "pfiDevtoolsOpenDetail", widgetVar: w.widgetVar });
        }
        return;
      }
      const head = e.target.closest(".dtp-card-head");
      if (head) {
        const card = head.closest(".dtp-card");
        expandedVar = expandedVar === card.dataset.var ? null : card.dataset.var;
        renderList();
      }
    });
  }
  function renderInfo() {
    const bar = document.getElementById("dtp-info");
    if (cannotInspect) {
      bar.className = "dtp-info dtp-info-warn";
      bar.innerHTML = `${icon("alert-triangle", 12)}<span>${escHtml(t("dtCannotInspect"))}</span>`;
      return;
    }
    if (!pageInfo) {
      bar.className = "dtp-info dtp-info-muted";
      bar.innerHTML = `${icon("clock", 12)}<span>${escHtml(t("dtConnecting"))}</span>`;
      return;
    }
    if (!pageInfo.hasPrimeFaces) {
      bar.className = "dtp-info dtp-info-warn";
      bar.innerHTML = `${icon("alert-triangle", 12)}<span>${escHtml(t("pfNotDetected"))}</span>`;
      return;
    }
    const parts = [`<span class="dtp-info-main">${escHtml(t("pfDetected", pageInfo.version || "?"))}</span>`];
    if (pageInfo.hasPrimeFacesExt) {
      parts.push(`<span class="dtp-info-sub">${escHtml(t("pfExtDetected", pageInfo.versionExt || "?"))}</span>`);
    }
    if (!pageInfo.hasJQuery) {
      parts.push(`<span class="dtp-info-sub dtp-warn-text">${escHtml(t("jqueryMissing"))}</span>`);
    }
    bar.className = "dtp-info dtp-info-ok";
    bar.innerHTML = `${icon("check-circle", 12)}${parts.join("")}`;
  }
  function renderTypeOptions() {
    const sel = document.getElementById("dtp-type");
    const types = Array.from(new Set(widgets.map((w) => w.type))).sort();
    if (typeFilter && !types.includes(typeFilter)) typeFilter = "";
    sel.innerHTML = `<option value="">${escHtml(t("filterAll"))}</option>` + types.map((ty) => `<option value="${escAttr(ty)}" ${ty === typeFilter ? "selected" : ""}>${escHtml(ty)}</option>`).join("");
  }
  function filteredWidgets() {
    return widgets.filter((w) => {
      const matchesSearch = !searchTerm || w.widgetVar.toLowerCase().includes(searchTerm) || w.id.toLowerCase().includes(searchTerm) || w.type.toLowerCase().includes(searchTerm);
      const matchesType = !typeFilter || w.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }
  function renderList() {
    const listEl = document.getElementById("dtp-list");
    const data = filteredWidgets();
    document.getElementById("dtp-count").textContent = `${data.length}/${widgets.length}`;
    if (data.length === 0) {
      listEl.innerHTML = `<div class="dtp-empty">${escHtml(t("noWidgets"))}</div>`;
      return;
    }
    listEl.innerHTML = data.map((w) => {
      const expanded = expandedVar === w.widgetVar;
      return `
      <div class="dtp-card ${expanded ? "dtp-expanded" : ""}" data-var="${escAttr(w.widgetVar)}">
        <div class="dtp-card-head">
          <span class="dtp-card-icon">${getComponentIcon(w.type, 16)}</span>
          <span class="dtp-wvar">${escHtml(w.widgetVar)}</span>
          <span class="dtp-type-badge">${escHtml(w.type)}</span>
          <span class="dtp-card-id" title="${escAttr(w.id)}">${escHtml(w.id)}</span>
          <span class="dtp-card-actions">
            <button class="dtp-btn" data-act="highlight" title="${escAttr(t("dtHighlight"))}">${icon("crosshair", 13)}</button>
            <button class="dtp-btn" data-act="open" title="${escAttr(t("dtOpenDetail"))}">${icon("maximize-2", 13)}</button>
            <span class="dtp-chevron">${icon("chevron-right", 13)}</span>
          </span>
        </div>
        ${expanded ? renderDetail(w) : ""}
      </div>
    `;
    }).join("");
  }
  function renderDetail(w) {
    const rows = [
      [t("labelWidgetVar"), w.widgetVar],
      [t("labelId"), w.id],
      [t("labelType"), w.type]
    ];
    if (w.targetId) rows.push([t("labelTargetId"), w.targetId]);
    const metaEntries = Object.entries(w.metadata || {});
    const metaHtml = metaEntries.length === 0 ? `<div class="dtp-detail-empty">${escHtml(t("dtMetaEmpty"))}</div>` : `<table class="dtp-table">${metaEntries.map(([k, v]) => `<tr><td>${escHtml(k)}</td><td><code>${escHtml(String(v))}</code></td></tr>`).join("")}</table>`;
    const api = (w.clientAPI || []).filter((m) => m.callable !== false);
    const apiHtml = api.length === 0 ? `<div class="dtp-detail-empty">${escHtml(t("dtNoMethods"))}</div>` : `<div class="dtp-chips">${api.map((m) => `<span class="dtp-chip"><code>${escHtml(m.name)}(${m.arity})</code></span>`).join("")}</div>`;
    const events = w.events || [];
    const eventsHtml = events.length === 0 ? `<div class="dtp-detail-empty">${escHtml(t("eventsEmpty"))}</div>` : events.map((ev) => `
        <div class="dtp-event">
          <span class="dtp-event-src dtp-src-${escAttr(ev.source)}">${escHtml(ev.source === "jquery" ? t("sourceJquery") : t("sourceInline"))}</span>
          <span class="dtp-event-name">${escHtml(ev.event)}</span>
          <code class="dtp-event-raw" title="${escAttr(ev.raw)}">${escHtml(ev.raw)}</code>
        </div>`).join("");
    return `
    <div class="dtp-detail">
      <table class="dtp-table dtp-table-main">${rows.map(([k, v]) => `<tr><td>${escHtml(k)}</td><td><code>${escHtml(v)}</code></td></tr>`).join("")}</table>
      <div class="dtp-section">${escHtml(t("sectionMetadata"))}</div>
      ${metaHtml}
      <div class="dtp-section">${escHtml(t("sectionClientApi"))} <span class="dtp-section-count">${api.length}</span></div>
      ${apiHtml}
      <div class="dtp-section">${escHtml(t("sectionEvents"))} <span class="dtp-section-count">${events.length}</span></div>
      ${eventsHtml}
    </div>
  `;
  }
  if (chrome.devtools.panels.themeName === "dark") {
    document.documentElement.classList.add("theme-dark");
  }
  buildSkeleton();
  renderInfo();
  renderList();
  connect();
  collect();
  setTimeout(() => {
    if (!pageInfo && !cannotInspect) collect();
  }, 1200);
  chrome.devtools.network.onNavigated.addListener(() => {
    pageInfo = null;
    widgets = [];
    expandedVar = null;
    renderInfo();
    renderList();
    setTimeout(collect, 700);
    setTimeout(() => {
      if (!pageInfo && !cannotInspect) collect();
    }, 2500);
  });
})();
