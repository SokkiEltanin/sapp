import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// Reliable keyboard height (px) across edge-to-edge Android + iOS, where
// `softwareKeyboardLayoutMode: 'pan'` / KeyboardAvoidingView are unreliable.
// Add the returned value as bottom padding / lift to keep inputs above the IME.
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvt, e => setHeight(e.endCoordinates?.height ?? 0));
    const onHide = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => { onShow.remove(); onHide.remove(); };
  }, []);

  return height;
}
