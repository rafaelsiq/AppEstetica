import { useState } from 'react';

const useLoginForm = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordHidden, setIsPasswordHidden] = useState(true);
    const [isEnabledToReceiveNotification, setIsEnabledToReceiveNotification] = useState(false);
    const [isClinic, setIsClinic] = useState(false);

    const handleRegister = () => {
    };
  
    const toggleSwitch = () => {
        setIsEnabledToReceiveNotification(previousState => !previousState);
    };

    const toggleIsClinicSwitch = () => {
        setIsClinic(previousState => !previousState);
    };

    return {
        username,
        setUsername,
        password,
        setPassword,
        isPasswordHidden,
        setIsPasswordHidden,
        handleRegister,
        isEnabledToReceiveNotification,
        isClinic,
        toggleSwitch,
        toggleIsClinicSwitch,
    };
};

export default useLoginForm;
