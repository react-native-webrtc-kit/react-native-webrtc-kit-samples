// https://github.com/otalk/sdp/blob/master/sdp.js を参考に RNKit / TypeScript 向けに書き換えている
//
export const sdpSplitLines = (blob: string) => {
  return blob.trim().split('\n').map(line => line.trim());
};

export const sdpSplitSections = (blob: string) => {
  const parts = blob.split('\nm=');
  return parts.map((part, index) => (index > 0 ?
    'm=' + part : part).trim() + '\r\n');
};

export const sdpGetDescription = (blob: string) => {
  const sections = sdpSplitSections(blob);
  return sections && sections[0];
};
