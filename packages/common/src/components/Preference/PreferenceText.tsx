import { ChangeEvent, FunctionComponent, createElement } from 'react';

import Input, { TextArea } from '../Input';

type Props = {
  block?: boolean;
  isTextArea?: boolean;
  placeholder?: string;
  rows?: number;
  setValue: (value: string) => void;
  value: string;
  style?: any;
};

export const PreferenceText: FunctionComponent<Props> = ({
  isTextArea,
  placeholder,
  setValue,
  value,
  ...props
}) => {
  const handleChange = ({ target }: ChangeEvent<HTMLInputElement>) => {
    setValue(target.value);
  };

  return createElement(isTextArea ? TextArea : Input, {
    style: { width: '9rem' },
    value,
    placeholder,
    onChange: handleChange,
    ...props,
  });
};
