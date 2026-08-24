import { resolveProfileNavigation } from 'c/alumniNewsList';

// Verifies the old-vs-new routing decision directly against the exported
// pure function. Testing this via a simulated click and asserting on
// NavigationMixin.Navigate isn't possible in this jest environment: LWC
// freezes the NavigationMixin prototype, so the [Navigate] method can't be
// spied on or overridden from a test.
describe('c-alumni-news-list resolveProfileNavigation', () => {
  it('resolves to the legacy standard record page when useNewProfileLink is false', () => {
    expect(resolveProfileNavigation(false, 'a0B000000000002')).toEqual({
      type: 'standard__recordPage',
      attributes: {
        actionName: 'view',
        recordId: 'a0B000000000002'
      }
    });
  });

  it('resolves to the new Alumni Profile page when useNewProfileLink is true', () => {
    expect(resolveProfileNavigation(true, 'a0B000000000002')).toEqual({
      type: 'comm__namedPage',
      attributes: {
        name: 'my_account__c'
      },
      state: {
        id: 'a0B000000000002'
      }
    });
  });
});
