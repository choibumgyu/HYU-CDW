import React from 'react';
import Dropdown from './Dropdown';

interface CardProps {
  title: string;
  options?: string[];
  value?: string;
  onOptionChange?: (selectedOption: string) => void;
}

const Card: React.FC<CardProps> = ({ title, options, value, onOptionChange }) => {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
        <dd className="mt-1 text-3xl font-semibold text-gray-900">
          {options && onOptionChange ? (
            <Dropdown options={options} value={value || ''} onChange={onOptionChange} />
          ) : (
            value
          )}
        </dd>
      </div>
    </div>
  );
};

export default Card;