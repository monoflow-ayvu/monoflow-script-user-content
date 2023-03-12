import * as MonoUtils from "@fermuch/monoutils";
import { currentLogin, myID } from "@fermuch/monoutils";

type PageConfig = {
  tags: string[];
  mode: 'show' | 'hide' | 'dock';
  id: string[];
}

type Config = Record<string, unknown> & {
  pages: PageConfig[];
}

const conf = new MonoUtils.config.Config<Config>();

const MY_TAGS = {
  loginId: '',
  lastUpdate: 0,
  tags: [],
};
const MAX_TAG_TIME = 10_000; // ms
function getMyTags(loginId) {
  if (MY_TAGS.loginId !== loginId || Date.now() - MY_TAGS.lastUpdate >= MAX_TAG_TIME) {
    const loginName = loginId || currentLogin() || '';
    const userTags = env.project?.logins?.find((login) => login.key === loginName || login.$modelId === loginName)?.tags || [];
    const deviceTags = env.project?.usersManager?.users?.find?.((u) => u.$modelId === myID())?.tags || [];
    const allTags = [...userTags, ...deviceTags];

    platform.log('[GPS] updating tags store');
    MY_TAGS.loginId = loginId;
    MY_TAGS.lastUpdate = Date.now();
    MY_TAGS.tags = allTags;
  }

  return MY_TAGS.tags;
}

function anyTagMatches(tags: string[], loginId?: string): boolean {
  // we always match if there are no tags
  if (!tags || tags.length === 0) return true;

  const loginName = loginId || currentLogin() || '';
  const allTags = getMyTags(loginName);

  return tags.some((t) => allTags.includes(t));
}

const originalPageStates: {[id: string]: {
  show: boolean;
  primary: boolean;
}} = {};

// on init keep a copy of the original state
messages.on('onInit', () => {
  env.project?.pagesManager?.pages.forEach((page) => {
    originalPageStates[page.$modelId] = {
      show: page.show,
      primary: page.primary,
    }
  });

  platform.log('initialized user content', originalPageStates);
});

function restorePages() {
  Object.keys(originalPageStates).forEach((pId) => {
    const p = originalPageStates[pId];
    ensurePage(pId, p.show, p.primary);
  });
}

// on exit restore original page state
messages.on('onEnd', () => {
  restorePages();
  platform.log('terminated user content, restoring:', originalPageStates);
});

messages.on('onLogout', () => {
  restorePages();
  platform.log('on logout user content, restoring:', originalPageStates);
})

function ensurePage(pageId: string, show: boolean, primary: boolean) {
  if (!pageId) return;
  const page = env.project?.pagesManager?.pages?.find((page) => page.$modelId === pageId)
  if (!page) return;

  const changes = {};

  if (page.show !== show) {
    changes['show'] = show;
  }
  
  if (page.primary !== primary) {
    changes['primary'] = primary;
  }

  if (Object.keys(changes).length > 0) {
    page._setRaw(changes)
  }
}

messages.on('onPeriodic', function() {
  if (!currentLogin()) {
    restorePages();
    return;
  }

  // ~~ PAGES ~~
  conf.get('pages', []).forEach((pageConf) => {
    if (!anyTagMatches(pageConf.tags)) {
      return;
    }

    for (const pageId of (pageConf.id || [])) {
      switch(pageConf.mode) {
        case 'show': ensurePage(pageId, true, false); break;
        case 'hide': ensurePage(pageId, false, false); break;
        case 'dock': ensurePage(pageId, true, true); break;
      }
    }
  })
});