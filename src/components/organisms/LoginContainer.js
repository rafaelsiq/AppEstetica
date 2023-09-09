import React from 'react';
import styled from 'styled-components/native';
import Header from '../molecules/Header/Header';
import LoginModal from '../molecules/LoginModal/LoginModal';

const Container = styled.View`
  flex: 1;
`;

const LoginContainer = () => {
  return (
    <Container>
      <Header/>
      <LoginModal />
    </Container>
  );
};

export default LoginContainer;
