@extends('layouts.app')



@section('content')
    <div class="wr-console-bg">
        <div class="wr-console-atmos">
            <span class="floating-spark spark-one" aria-hidden="true"></span>
            <span class="floating-spark spark-two" aria-hidden="true"></span>
            <span class="floating-spark spark-three" aria-hidden="true"></span>
            <span class="floating-spark spark-four" aria-hidden="true"></span>

            <div class="wr-console-container">
                @yield('console-content')
            </div>
        </div>
    </div>
@endsection

