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

function anyTagMatches(tags: string[]): boolean {
  // we always match if there are no tags
  if (!tags || tags.length === 0) return true;

  const userTags = env.project?.logins?.find((login) => login.key === currentLogin())?.tags || [];
  const deviceTags = env.project?.usersManager?.users?.find?.((u) => u.$modelId === myID())?.tags || [];
  const allTags = [...userTags, ...deviceTags];

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

// on exit restore original page state
messages.on('onEnd', () => {
  Object.keys(originalPageStates).forEach((pId) => {
    const p = originalPageStates[pId];
    ensurePage(pId, p.show, p.primary);
  });

  platform.log('terminated user content, restoring:', originalPageStates);
});

messages.on('onLogout', () => {
  Object.keys(originalPageStates).forEach((pId) => {
    const p = originalPageStates[pId];
    ensurePage(pId, p.show, p.primary);
  });

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

messages.on('onLogin', function() {
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