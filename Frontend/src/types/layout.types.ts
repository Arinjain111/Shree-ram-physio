// Layout configuration type definitions

export interface LayoutConfig {
  clinicName: string;
  clinicTagline?: string;
  clinicNameMaxWidth?: number;
  logoClinicNameSpacing?: number;
  clinicNameSingleLine?: boolean;
  address: string;
  uan: string;
  regNo: string;
  logoPath: string;
  signatureImagePath?: string;
  clinicPhone: string;
  clinicEmail: string;
  doctorName: string;
  doctorQualification: string;
  doctorMobile: string;
  headerAlign: 'left' | 'center' | 'right';
  logoPosition: 'left' | 'center' | 'right';
  headerLeftAlign?: 'left' | 'center' | 'right';
  headerRightAlign?: 'left' | 'center' | 'right';
  fontSize: 'small' | 'medium' | 'large';
  showBorder: boolean;
  // Advanced header customization fields
  logoArrangement?: 'inline' | 'stack';
  rightBlockPosition?: 'top' | 'middle' | 'bottom';
  fontSizeValue?: number;
  metaFontSize?: number;
  logoMaxWidth?: number;
  logoMaxHeight?: number;
  headerBgColor?: string;
  headerTextColor?: string;
  headerPadding?: number;
  // Title and section styling
  title?: string;
  titleBgColor?: string;
  titleTextColor?: string;
  sectionBgColor?: string;
  footerTextColor?: string;
  footerBgColor?: string;

  // Footer customization
  footerNoteTitle?: string;
  footerNotes?: string; // newline-separated
  signatureLabel?: string;
  signatureName?: string;
  signatureQualification?: string;
}
