import { LightningElement } from 'lwc';
import getMyProfile from '@salesforce/apex/AlumniProfileController.getMyProfile';
import saveMyProfile from '@salesforce/apex/AlumniProfileController.saveMyProfile';

export default class AlumniProfile extends LightningElement {
  // ─── Record state ─────────────────────────────────────────────────────────
  profile = {};
  isLoading = true;
  isEditMode = false;
  isSaving = false;
  errorMessage = '';

  // ─── Edit-mode draft state (separate from display state so Cancel is a no-op revert) ───
  draftFirstNameText = '';
  draftNickname = '';
  draftLastNameText = '';
  draftStudentLastNameText = '';
  draftClassYearText = '';
  draftStThomasDegreeText = '';
  draftCityState = '';
  draftOccupationText = '';
  draftEmployerText = '';

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  connectedCallback() {
    this.loadProfile();
  }

  loadProfile() {
    this.isLoading = true;
    getMyProfile()
      .then((data) => {
        this.profile = data;
        this.errorMessage = '';
      })
      .catch((error) => {
        this.errorMessage = error?.body?.message || 'Unable to load your alumni profile.';
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  // ─── Computed display getters ────────────────────────────────────────────

  get hasRecord() {
    return !!this.profile?.hasRecord;
  }

  get showEmptyState() {
    return !this.isLoading && !this.hasRecord;
  }

  get displayFirstName() {
    return this.profile.nickname?.trim() || this.profile.firstNameText || '';
  }

  get displayLastName() {
    const lastName = this.profile.lastNameText || '';
    const studentLastName = this.profile.studentLastNameText;
    return studentLastName && studentLastName !== lastName
      ? `${lastName} (${studentLastName})`
      : lastName;
  }

  get businessDirectoryRecords() {
    return this.profile.businessDirectoryRecords || [];
  }

  get hasBusinessDirectoryRecords() {
    return this.businessDirectoryRecords.length > 0;
  }

  get showEditButton() {
    return this.profile.canEdit && !this.isEditMode;
  }

  get showDisplayMode() {
    return this.hasRecord && !this.isEditMode;
  }

  get showEditMode() {
    return this.hasRecord && this.isEditMode;
  }

  // ─── Edit mode ────────────────────────────────────────────────────────────

  handleEditClick() {
    this.draftFirstNameText = this.profile.firstNameText || '';
    this.draftNickname = this.profile.nickname || '';
    this.draftLastNameText = this.profile.lastNameText || '';
    this.draftStudentLastNameText = this.profile.studentLastNameText || '';
    this.draftClassYearText = this.profile.classYearText || '';
    this.draftStThomasDegreeText = this.profile.stThomasDegreeText || '';
    this.draftCityState = this.profile.cityState || '';
    this.draftOccupationText = this.profile.occupationText || '';
    this.draftEmployerText = this.profile.employerText || '';
    this.errorMessage = '';
    this.isEditMode = true;
  }

  handleCancelClick() {
    this.isEditMode = false;
  }

  handleFieldChange(event) {
    const field = event.currentTarget.dataset.field;
    this[field] = event.detail.value;
  }

  handleSaveClick() {
    this.isSaving = true;
    saveMyProfile({
      input: {
        recordId: this.profile.recordId,
        firstNameText: this.draftFirstNameText,
        nickname: this.draftNickname,
        lastNameText: this.draftLastNameText,
        studentLastNameText: this.draftStudentLastNameText,
        classYearText: this.draftClassYearText,
        stThomasDegreeText: this.draftStThomasDegreeText,
        cityState: this.draftCityState,
        occupationText: this.draftOccupationText,
        employerText: this.draftEmployerText
      }
    })
      .then((data) => {
        this.profile = data;
        this.errorMessage = '';
        this.isEditMode = false;
      })
      .catch((error) => {
        this.errorMessage = error?.body?.message || 'Unable to save your changes.';
      })
      .finally(() => {
        this.isSaving = false;
      });
  }
}
