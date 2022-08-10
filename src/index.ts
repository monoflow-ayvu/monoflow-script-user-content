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
  })
});

// on exit restore original page state
messages.on('onEnd', () => {
  Object.keys(originalPageStates).forEach((pId) => {
    const p = originalPageStates[pId];
    env.project?.pagesManager?.pages?.find((page) => page.$modelId === pId)?._setRaw({
      show: p.show,
      primary: p.primary,
    });
  });
});


messages.on('onPeriodic', function() {
  // ~~ PAGES ~~
  conf.get('pages', []).forEach((pageConf) => {
    if (!anyTagMatches(pageConf.tags)) {
      return;
    }

    for (const pageId of (pageConf.id || [])) {
      const page = env.project?.pagesManager?.pages?.find((page) => page.$modelId === pageId)
      if (!page) continue;

      switch(pageConf.mode) {
        case 'show': page._setRaw({show: true, primary: false}); break;
        case 'hide': page._setRaw({show: false, primary: false}); break;
        case 'dock': page._setRaw({show: true, primary: true}); break;
      }
    }
  })
});